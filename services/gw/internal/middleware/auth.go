package middleware

import (
	"context"
	"net/http"
	"strings"

	"log/slog"

	"github.com/itcamp/ktc/services/gw/internal/auth"
)

func AuthMiddleware(authClient *auth.Client, log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractBearer(r)
			if token == "" {
				writeProblem(w, http.StatusUnauthorized, "missing_token", "Authorization Bearer token required")
				return
			}

			result, err := authClient.Introspect(r.Context(), token)
			if err != nil {
				log.WarnContext(r.Context(), "introspect failed", "error", err)
				writeProblem(w, http.StatusBadGateway, "auth_unavailable", "auth service unavailable")
				return
			}
			if !result.Active {
				writeProblem(w, http.StatusUnauthorized, "invalid_token", "token is not active")
				return
			}

			ctx := r.Context()
			ctx = context.WithValue(ctx, CtxUserID, result.UserID)
			ctx = context.WithValue(ctx, CtxLogin, result.Login)
			ctx = context.WithValue(ctx, CtxRoles, result.Roles)
			ctx = context.WithValue(ctx, CtxToken, token)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func InjectHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Header.Del("X-User-ID")
		r.Header.Del("X-Login")
		r.Header.Del("X-Roles")

		ctx := r.Context()
		if uid := ContextString(ctx, CtxUserID); uid != "" {
			r.Header.Set("X-User-ID", uid)
		}
		if login := ContextString(ctx, CtxLogin); login != "" {
			r.Header.Set("X-Login", login)
		}
		if roles := ContextRoles(ctx); len(roles) > 0 {
			r.Header.Set("X-Roles", strings.Join(roles, ","))
		}

		next.ServeHTTP(w, r)
	})
}

func RequireRoles(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if len(allowed) == 0 {
				next.ServeHTTP(w, r)
				return
			}
			userRoles := ContextRoles(r.Context())
			for _, ur := range userRoles {
				if _, ok := allowed[ur]; ok {
					next.ServeHTTP(w, r)
					return
				}
			}
			writeProblem(w, http.StatusForbidden, "forbidden", "insufficient role")
		})
	}
}

func writeProblem(w http.ResponseWriter, status int, code, detail string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"type":"about:blank","title":"` + code + `","status":` + itoa(status) + `,"detail":"` + detail + `"}`))
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [10]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
