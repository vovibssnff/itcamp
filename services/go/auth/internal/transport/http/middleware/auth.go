package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/itcamp/ktc/services/auth/internal/service"
)

// Auth проверяет Bearer-токен через introspect и кладёт идентичность
// пользователя (user_id, roles) в контекст запроса. Невалидный токен → 401.
func Auth(intro *service.IntrospectService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authz := r.Header.Get("Authorization")
			const prefix = "Bearer "
			if !strings.HasPrefix(authz, prefix) {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			token := strings.TrimPrefix(authz, prefix)
			res, err := intro.Introspect(r.Context(), token)
			if err != nil || !res.Active || res.Claims == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			roles := make([]string, 0, len(res.Claims.Roles))
			for _, role := range res.Claims.Roles {
				roles = append(roles, string(role))
			}
			ctx := context.WithValue(r.Context(), CtxUserID, res.Claims.UserID)
			ctx = context.WithValue(ctx, CtxRoles, roles)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
