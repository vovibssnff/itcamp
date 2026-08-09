package auth

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/itcamp/ktc/services/gw/internal/config"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestClient_Introspect_EmptyToken(t *testing.T) {
	var called bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := NewClient(config.AuthClientConfig{URL: srv.URL}, discardLogger())
	res, err := c.Introspect(context.Background(), "")
	if err != nil {
		t.Fatalf("Introspect: %v", err)
	}
	if res.Active {
		t.Error("active should be false for empty token")
	}
	if called {
		t.Error("should not call upstream for empty token")
	}
}

func TestClient_Introspect_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"active":true,"user_id":"u-1","login":"alice","roles":["admin"],"token_id":"t-1"}`))
	}))
	defer srv.Close()

	c := NewClient(config.AuthClientConfig{URL: srv.URL}, discardLogger())
	res, err := c.Introspect(context.Background(), "tok")
	if err != nil {
		t.Fatalf("Introspect: %v", err)
	}
	if !res.Active || res.UserID != "u-1" || len(res.Roles) != 1 || res.Roles[0] != "admin" {
		t.Errorf("unexpected result: %+v", res)
	}
}

func TestClient_Introspect_NonSuccessStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := NewClient(config.AuthClientConfig{URL: srv.URL}, discardLogger())
	if _, err := c.Introspect(context.Background(), "tok"); err == nil {
		t.Error("expected error for non-200 status")
	}
}

func TestClient_Introspect_BadJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`not json`))
	}))
	defer srv.Close()

	c := NewClient(config.AuthClientConfig{URL: srv.URL}, discardLogger())
	if _, err := c.Introspect(context.Background(), "tok"); err == nil {
		t.Error("expected error for malformed JSON")
	}
}

func TestTokenCache_GetSet(t *testing.T) {
	c := newTokenCache(30*time.Second, 10)
	res := IntrospectResponse{Active: true, UserID: "u"}
	c.set("t1", res)
	got, ok := c.get("t1")
	if !ok || !got.Active || got.UserID != "u" {
		t.Errorf("get = %+v, ok=%v", got, ok)
	}
	if _, ok := c.get("missing"); ok {
		t.Error("missing key should not be found")
	}
}

func TestTokenCache_Expired(t *testing.T) {
	c := newTokenCache(1*time.Millisecond, 10)
	c.set("t1", IntrospectResponse{Active: true, UserID: "u"})
	time.Sleep(5 * time.Millisecond)
	if _, ok := c.get("t1"); ok {
		t.Error("expired item should be evicted")
	}
}

func TestTokenCache_Revocation(t *testing.T) {
	c := newTokenCache(30*time.Second, 10)
	c.set("tok", IntrospectResponse{Active: true, UserID: "u", Roles: []string{"admin"}})
	// simulate token being revoked -> update stored value
	c.set("tok", IntrospectResponse{Active: false})
	got, ok := c.get("tok")
	if !ok || got.Active {
		t.Errorf("revoked token should return inactive, got %+v ok=%v", got, ok)
	}
}

func TestTokenCache_EvictWhenFull_Empty(t *testing.T) {
	c := newTokenCache(30*time.Second, 2)
	c.set("a", IntrospectResponse{UserID: "1"})
	c.set("b", IntrospectResponse{UserID: "2"})
	c.set("c", IntrospectResponse{UserID: "3"}) // exceeds maxSize -> evicts
	if len(c.items) > 2 {
		t.Errorf("cache size = %d, want <= 2", len(c.items))
	}
	if _, ok := c.get("c"); !ok {
		t.Error("newest item should be present")
	}
}

func TestTokenCache_Defaults(t *testing.T) {
	c := newTokenCache(0, 0)
	if c.ttl != 30*time.Second {
		t.Errorf("default ttl = %v, want 30s", c.ttl)
	}
	if c.maxSize != 1000 {
		t.Errorf("default maxSize = %d, want 1000", c.maxSize)
	}
}
