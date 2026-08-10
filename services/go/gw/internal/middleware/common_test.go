package middleware

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestExtractBearer(t *testing.T) {
	tests := []struct {
		name   string
		header string
		want   string
	}{
		{"valid", "Bearer abc123", "abc123"},
		{"lowercase", "bearer token-1", "token-1"},
		{"extra spaces", "Bearer    spaced", "spaced"},
		{"missing", "", ""},
		{"not bearer", "Basic abc", ""},
		{"no space", "Bearerxyz", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.header != "" {
				r.Header.Set("Authorization", tt.header)
			}
			if got := extractBearer(r); got != tt.want {
				t.Errorf("extractBearer() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestExtractToken(t *testing.T) {
	t.Run("bearer preferred", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "/ws?token=from-query", nil)
		r.Header.Set("Authorization", "Bearer from-header")
		r.Header.Set("Upgrade", "websocket")
		r.Header.Set("Connection", "Upgrade")
		if got := extractToken(r); got != "from-header" {
			t.Errorf("extractToken() = %q, want from-header", got)
		}
	})
	t.Run("ws query token", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "/ws?token=ws-tok", nil)
		r.Header.Set("Upgrade", "websocket")
		r.Header.Set("Connection", "Upgrade")
		if got := extractToken(r); got != "ws-tok" {
			t.Errorf("extractToken() = %q, want ws-tok", got)
		}
	})
	t.Run("ws access_token", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "/ws?access_token=at-1", nil)
		r.Header.Set("Upgrade", "websocket")
		r.Header.Set("Connection", "upgrade")
		if got := extractToken(r); got != "at-1" {
			t.Errorf("extractToken() = %q, want at-1", got)
		}
	})
	t.Run("query ignored without upgrade", func(t *testing.T) {
		r := httptest.NewRequest(http.MethodGet, "/api?token=nope", nil)
		if got := extractToken(r); got != "" {
			t.Errorf("extractToken() = %q, want empty", got)
		}
	})
}

func TestContextString(t *testing.T) {
	ctx := context.WithValue(context.Background(), CtxUserID, "u-1")
	if got := ContextString(ctx, CtxUserID); got != "u-1" {
		t.Errorf("ContextString = %q, want u-1", got)
	}
	if got := ContextString(ctx, CtxLogin); got != "" {
		t.Errorf("ContextString missing key = %q, want empty", got)
	}
	if got := ContextString(context.Background(), CtxUserID); got != "" {
		t.Errorf("ContextString empty ctx = %q, want empty", got)
	}
}

func TestContextRoles(t *testing.T) {
	ctx := context.WithValue(context.Background(), CtxRoles, []string{"admin", "operator"})
	got := ContextRoles(ctx)
	if len(got) != 2 || got[0] != "admin" {
		t.Errorf("ContextRoles = %v", got)
	}
	if got := ContextRoles(context.Background()); got != nil {
		t.Errorf("ContextRoles empty ctx = %v, want nil", got)
	}
}

func TestItoa(t *testing.T) {
	check := map[int]string{0: "0", 5: "5", 200: "200", 429: "429", 503: "503"}
	for in, want := range check {
		if got := itoa(in); got != want {
			t.Errorf("itoa(%d) = %q, want %q", in, got, want)
		}
	}
}

func TestRecover_NoPanic(t *testing.T) {
	h := Recover(discardLogger())(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
	if rec.Code != http.StatusOK {
		t.Errorf("code = %d, want 200", rec.Code)
	}
}

func TestRecover_Panic(t *testing.T) {
	h := Recover(discardLogger())(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		panic("boom")
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("code = %d, want 500", rec.Code)
	}
}

func TestRequestLogger_PassesThrough(t *testing.T) {
	called := false
	h := RequestLogger(discardLogger())(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
	if !called || rec.Code != http.StatusNoContent {
		t.Error("RequestLogger did not pass through")
	}
}
