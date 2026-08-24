package server

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/itcamp/ktc/services/gw/internal/auth"
	"github.com/itcamp/ktc/services/gw/internal/config"
	"github.com/itcamp/ktc/services/gw/internal/proxy"
)

// More-specific /assessment/override must win over /assessment/{path...}
// so instructor-only RBAC is applied (operators must not override scores).
func TestRegisterRoutes_OverrideMoreSpecificThanAssessmentPrefix(t *testing.T) {
	assessment := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	t.Cleanup(assessment.Close)

	authSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Token string `json:"token"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		roles := []string{"operator"}
		if body.Token == "instructor-token" {
			roles = []string{"instructor"}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(auth.IntrospectResponse{
			Active: true, UserID: "u-1", Login: "u", Roles: roles, TokenID: "t-1",
		})
	}))
	t.Cleanup(authSrv.Close)

	cfg := config.Config{
		HTTP: config.HTTPConfig{Addr: ":0"},
		Upstreams: map[string]config.UpstreamConfig{
			"assessment": {URL: assessment.URL},
		},
		Routes: []config.RouteConfig{
			{
				Prefix:      "/api/v1/assessment/override",
				Upstream:    "assessment",
				StripPrefix: "/api/v1",
				Auth:        true,
				Roles:       []string{"instructor", "admin"},
			},
			{
				Prefix:      "/api/v1/assessment",
				Upstream:    "assessment",
				StripPrefix: "/api/v1",
				Auth:        true,
				Roles:       []string{"instructor", "admin", "operator"},
			},
		},
	}

	reg, err := proxy.NewRegistry(cfg.Upstreams)
	if err != nil {
		t.Fatal(err)
	}
	authClient := auth.NewClient(config.AuthClientConfig{
		URL:      authSrv.URL,
		Timeout:  config.Duration(2 * time.Second),
		CacheTTL: config.Duration(time.Millisecond), // avoid cross-role cache bleed
	}, slog.New(slog.NewTextHandler(io.Discard, nil)))

	mux := http.NewServeMux()
	registerRoutes(mux, Deps{
		Cfg:      cfg,
		Auth:     authClient,
		Registry: reg,
		Log:      slog.New(slog.NewTextHandler(io.Discard, nil)),
	})

	t.Run("operator denied on override", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/assessment/override", nil)
		req.Header.Set("Authorization", "Bearer operator-token")
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("status = %d body=%s, want 403", rec.Code, rec.Body.String())
		}
	})

	t.Run("instructor allowed on override", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/assessment/override", nil)
		req.Header.Set("Authorization", "Bearer instructor-token")
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d body=%s, want 200", rec.Code, rec.Body.String())
		}
	})

	t.Run("operator still allowed on score", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/assessment/session/s1/score", nil)
		req.Header.Set("Authorization", "Bearer operator-token")
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d body=%s, want 200", rec.Code, rec.Body.String())
		}
	})
}
