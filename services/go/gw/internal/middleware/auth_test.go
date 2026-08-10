package middleware

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/itcamp/ktc/services/gw/internal/auth"
	"github.com/itcamp/ktc/services/gw/internal/config"
)

func newAuthClient(t *testing.T, handler http.HandlerFunc) *auth.Client {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	cfg := config.AuthClientConfig{
		URL:      srv.URL,
		Timeout:  config.Duration(2 * time.Second),
		CacheTTL: config.Duration(30 * time.Second),
	}
	return auth.NewClient(cfg, slog.New(slog.NewTextHandler(io.Discard, nil)))
}

func introspectHandler(active bool, userID string, roles []string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(auth.IntrospectResponse{
			Active: active, UserID: userID, Login: "login", Roles: roles,
		})
	}
}

func TestAuthMiddlewareMissingToken(t *testing.T) {
	c := newAuthClient(t, introspectHandler(true, "u-1", []string{"admin"}))
	h := AuthMiddleware(c, discardLogger())(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", rec.Code)
	}
}

func TestAuthMiddlewareWebSocketQueryToken(t *testing.T) {
	c := newAuthClient(t, introspectHandler(true, "u-ws", []string{"operator"}))
	var gotAuth string
	var gotUID string
	h := AuthMiddleware(c, discardLogger())(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotUID = ContextString(r.Context(), CtxUserID)
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/ws/sessions/s1/operator?token=ws-tok", nil)
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Connection", "Upgrade")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200", rec.Code)
	}
	if gotUID != "u-ws" {
		t.Errorf("user id = %q, want u-ws", gotUID)
	}
	if gotAuth != "Bearer ws-tok" {
		t.Errorf("Authorization = %q, want Bearer ws-tok", gotAuth)
	}
}

func TestAuthMiddlewareQueryTokenIgnoredWithoutUpgrade(t *testing.T) {
	c := newAuthClient(t, introspectHandler(true, "u-1", []string{"admin"}))
	h := AuthMiddleware(c, discardLogger())(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/sessions?token=ws-tok", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", rec.Code)
	}
}

func TestAuthMiddlewareValidToken(t *testing.T) {
	c := newAuthClient(t, introspectHandler(true, "u-1", []string{"admin", "operator"}))
	var gotCtx context.Context
	h := AuthMiddleware(c, discardLogger())(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotCtx = r.Context()
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer tok-1")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200", rec.Code)
	}
	if got := ContextString(gotCtx, CtxUserID); got != "u-1" {
		t.Errorf("user id = %q, want u-1", got)
	}
	if got := ContextRoles(gotCtx); len(got) != 2 {
		t.Errorf("roles = %v, want 2 roles", got)
	}
}

func TestAuthMiddlewareInactiveToken(t *testing.T) {
	c := newAuthClient(t, introspectHandler(false, "", nil))
	h := AuthMiddleware(c, discardLogger())(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer bad")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("code = %d, want 401", rec.Code)
	}
}

func TestAuthMiddlewareUnavailable(t *testing.T) {
	// server returns 500 -> auth unavailable
	c := newAuthClient(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	h := AuthMiddleware(c, discardLogger())(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer tok")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Errorf("code = %d, want 502", rec.Code)
	}
}

func TestInjectHeaders(t *testing.T) {
	h := InjectHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("X-User-ID"); got != "u-1" {
			t.Errorf("X-User-ID = %q, want u-1", got)
		}
		if got := r.Header.Get("X-Login"); got != "alice" {
			t.Errorf("X-Login = %q, want alice", got)
		}
		if got := r.Header.Get("X-Roles"); got != "admin,operator" {
			t.Errorf("X-Roles = %q, want admin,operator", got)
		}
		w.WriteHeader(http.StatusOK)
	}))

	ctx := context.Background()
	ctx = context.WithValue(ctx, CtxUserID, "u-1")
	ctx = context.WithValue(ctx, CtxLogin, "alice")
	ctx = context.WithValue(ctx, CtxRoles, []string{"admin", "operator"})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	// attempt to spoof headers -> must be stripped and replaced from trusted ctx
	req.Header.Set("X-User-ID", "spoofed")
	req.Header.Set("X-Roles", "spoofed")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req.WithContext(ctx))
}

func TestInjectHeaders_NoContext(t *testing.T) {
	h := InjectHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("X-User-ID"); got != "" {
			t.Errorf("X-User-ID = %q, want empty", got)
		}
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
}

func TestRequireRoles_Allowed(t *testing.T) {
	h := RequireRoles("instructor", "admin")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	ctx := context.WithValue(context.Background(), CtxRoles, []string{"operator", "admin"})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx))
	if rec.Code != http.StatusOK {
		t.Errorf("code = %d, want 200", rec.Code)
	}
}

func TestRequireRoles_Denied(t *testing.T) {
	h := RequireRoles("admin")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	ctx := context.WithValue(context.Background(), CtxRoles, []string{"operator"})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx))
	if rec.Code != http.StatusForbidden {
		t.Errorf("code = %d, want 403", rec.Code)
	}
}

func TestRequireRoles_NoRolesConstraint(t *testing.T) {
	h := RequireRoles()(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusOK {
		t.Errorf("code = %d, want 200", rec.Code)
	}
}

// Auth must wrap RequireRoles (outermost) so introspect populates CtxRoles first.
func TestAuthThenRequireRoles_Composition(t *testing.T) {
	c := newAuthClient(t, introspectHandler(true, "u-1", []string{"instructor"}))
	inner := RequireRoles("instructor", "admin")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	h := AuthMiddleware(c, discardLogger())(inner)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer tok")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("correct order: code = %d, want 200", rec.Code)
	}

	// Wrong order (roles before auth) leaves CtxRoles empty → 403.
	wrong := AuthMiddleware(c, discardLogger())(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	wrong = RequireRoles("instructor", "admin")(wrong)
	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	req2.Header.Set("Authorization", "Bearer tok")
	rec2 := httptest.NewRecorder()
	wrong.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusForbidden {
		t.Fatalf("wrong order: code = %d, want 403", rec2.Code)
	}
}
