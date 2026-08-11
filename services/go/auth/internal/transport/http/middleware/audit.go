package middleware

import (
	"context"
	"net/http"

	"github.com/itcamp/ktc/services/auth/internal/service"
)

func Audit(audit *service.AuditService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), CtxIP, clientIP(r))
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
