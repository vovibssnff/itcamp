package proxy

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/itcamp/ktc/services/gw/internal/config"
)

func TestNewRegistry(t *testing.T) {
	ups := map[string]config.UpstreamConfig{
		"sim": {URL: "http://sim:9000"},
	}
	r, err := NewRegistry(ups)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	p, url, ok := r.Get("sim")
	if !ok || p == nil || url == nil {
		t.Fatal("expected sim upstream in registry")
	}
	if _, _, ok := r.Get("missing"); ok {
		t.Error("missing upstream should not be found")
	}
}

func TestNewRegistry_InvalidURL(t *testing.T) {
	ups := map[string]config.UpstreamConfig{
		"bad": {URL: "://not-a-url"},
	}
	if _, err := NewRegistry(ups); err == nil {
		t.Error("expected error for invalid upstream URL")
	}
}

func TestProxyHandler_StripPrefix(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "path=%s host=%s proto=%s", r.URL.Path, r.Header.Get("X-Forwarded-Host"), r.Header.Get("X-Forwarded-Proto"))
	}))
	defer upstream.Close()

	r, err := NewRegistry(map[string]config.UpstreamConfig{"sim": {URL: upstream.URL}})
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	route := config.RouteConfig{Prefix: "/api/v1/sessions", Upstream: "sim", StripPrefix: "/api/v1"}
	h := r.ProxyHandler(route)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/sessions/123", nil)
	req.Host = "gateway.local"
	h.ServeHTTP(rec, req)

	body, _ := io.ReadAll(rec.Body)
	want := "path=/sessions/123 host=gateway.local proto=https"
	if string(body) != want {
		t.Errorf("body = %q, want %q", string(body), want)
	}
}

func TestProxyHandler_UndefinedUpstream(t *testing.T) {
	r, err := NewRegistry(map[string]config.UpstreamConfig{"sim": {URL: "http://sim:9000"}})
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	h := r.ProxyHandler(config.RouteConfig{Prefix: "/x", Upstream: "nope"})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
	if rec.Code != http.StatusBadGateway {
		t.Errorf("code = %d, want 502", rec.Code)
	}
}

func TestProxyHandler_UpstreamUnavailable(t *testing.T) {
	// upstream URL points to a closed port -> proxy error -> 502 via ErrorHandler
	r, err := NewRegistry(map[string]config.UpstreamConfig{"sim": {URL: "http://127.0.0.1:1"}})
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	h := r.ProxyHandler(config.RouteConfig{Prefix: "/x", Upstream: "sim"})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
	if rec.Code != http.StatusBadGateway {
		t.Errorf("code = %d, want 502", rec.Code)
	}
}

// TestProxyHandler_BasePathJoining verifies that when an upstream URL contains
// a base path (e.g. /v1), NewSingleHostReverseProxy joins it with the stripped
// request path. This is the mechanism used for the ai upstream:
//
//	/api/v1/ai/chat  --strip(/api/v1/ai)--> /chat  --join(/v1)--> /v1/chat
func TestProxyHandler_BasePathJoining(t *testing.T) {
	var gotPath string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		fmt.Fprint(w, "ok")
	}))
	defer upstream.Close()

	r, err := NewRegistry(map[string]config.UpstreamConfig{
		"ai": {URL: upstream.URL + "/v1"},
	})
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	route := config.RouteConfig{Prefix: "/api/v1/ai", Upstream: "ai", StripPrefix: "/api/v1/ai"}
	h := r.ProxyHandler(route)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/ai/chat", nil)
	h.ServeHTTP(rec, req)

	if gotPath != "/v1/chat" {
		t.Errorf("upstream received path %q, want %q", gotPath, "/v1/chat")
	}
}
