package middleware

import (
	"net/http"
	"sync"
	"time"

	"log/slog"
)

type rateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	limit    int
	window   time.Duration
}

type visitor struct {
	count    int
	lastSeen time.Time
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		visitors: make(map[string]*visitor),
		limit:    limit,
		window:   window,
	}
	go rl.cleanup()
	return rl
}

func (rl *rateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[key]
	if !exists || time.Since(v.lastSeen) > rl.window {
		rl.visitors[key] = &visitor{count: 1, lastSeen: time.Now()}
		return true
	}
	v.count++
	v.lastSeen = time.Now()
	return v.count <= rl.limit
}

func (rl *rateLimiter) cleanup() {
	ticker := time.NewTicker(rl.window)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		for ip, v := range rl.visitors {
			if time.Since(v.lastSeen) > rl.window {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func RateLimit(perMin int, log *slog.Logger) func(http.Handler) http.Handler {
	if perMin <= 0 {
		perMin = 100
	}
	rl := newRateLimiter(perMin, time.Minute)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
				ip = fwd
			}
			if !rl.allow(ip) {
				w.Header().Set("Retry-After", "60")
				writeProblem(w, http.StatusTooManyRequests, "rate_limit", "too many requests")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
