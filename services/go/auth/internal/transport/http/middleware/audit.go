package middleware

import (
	"context"
	"net/http"

	"log/slog"

	"github.com/itcamp/ktc/services/auth/internal/service"
)

func Audit(audit *service.AuditService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
				ip = fwd
			}
			ctx := context.WithValue(r.Context(), CtxIP, ip)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func LogAuthAttempt(log *slog.Logger, event string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r)
		})
	}
}
