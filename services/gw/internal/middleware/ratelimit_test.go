package middleware

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiter_Allow(t *testing.T) {
	rl := newRateLimiter(3, time.Minute)
	for i := 1; i <= 3; i++ {
		if !rl.allow("1.2.3.4") {
			t.Fatalf("request %d should be allowed (limit 3)", i)
		}
	}
	if rl.allow("1.2.3.4") {
		t.Error("4th request should be denied")
	}
}

func TestRateLimiter_AllowWindowReset(t *testing.T) {
	rl := newRateLimiter(2, 10*time.Millisecond)
	rl.allow("1.1.1.1")
	rl.allow("1.1.1.1")
	if rl.allow("1.1.1.1") {
		t.Error("3rd request should be denied within window")
	}
	time.Sleep(30 * time.Millisecond)
	if !rl.allow("1.1.1.1") {
		t.Error("request after window should be allowed")
	}
}

func TestRateLimiter_DifferentIPsIndependent(t *testing.T) {
	rl := newRateLimiter(2, time.Minute)
	rl.allow("ip-a")
	rl.allow("ip-a")
	if rl.allow("ip-a") {
		t.Error("ip-a should be limited")
	}
	if !rl.allow("ip-b") {
		t.Error("ip-b should be independent and allowed")
	}
}

func TestRateLimitMiddleware(t *testing.T) {
	fmtLogger := slog.New(slog.NewTextHandler(io.Discard, nil))
	// limit 2 per minute
	h := RateLimit(2, fmtLogger)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "10.0.0.1:1234"

	rec1 := httptest.NewRecorder()
	h.ServeHTTP(rec1, req)
	if rec1.Code != http.StatusOK {
		t.Errorf("req1 code = %d, want 200", rec1.Code)
	}
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, req)
	if rec2.Code != http.StatusOK {
		t.Errorf("req2 code = %d, want 200", rec2.Code)
	}
	rec3 := httptest.NewRecorder()
	h.ServeHTTP(rec3, req)
	if rec3.Code != http.StatusTooManyRequests {
		t.Errorf("req3 code = %d, want 429", rec3.Code)
	}
	if rec3.Header().Get("Retry-After") != "60" {
		t.Errorf("Retry-After = %q, want 60", rec3.Header().Get("Retry-After"))
	}
}

func TestRateLimitUsesForwardedFor(t *testing.T) {
	fmtLogger := slog.New(slog.NewTextHandler(io.Discard, nil))
	h := RateLimit(1, fmtLogger)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "10.0.0.9:1"
	req.Header.Set("X-Forwarded-For", "198.51.100.7")

	rec1 := httptest.NewRecorder()
	h.ServeHTTP(rec1, req)
	if rec1.Code != http.StatusOK {
		t.Errorf("req1 code = %d, want 200", rec1.Code)
	}
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, req)
	if rec2.Code != http.StatusTooManyRequests {
		t.Errorf("req2 code = %d, want 429 (via X-Forwarded-For)", rec2.Code)
	}
}
