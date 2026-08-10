package middleware

import (
	"context"
	"net/http"
	"runtime/debug"
	"strings"

	"log/slog"
)

type ctxKey string

const (
	CtxUserID ctxKey = "user_id"
	CtxLogin  ctxKey = "login"
	CtxRoles  ctxKey = "roles"
	CtxToken  ctxKey = "token"
)

func Recover(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					log.ErrorContext(r.Context(), "panic recovered",
						"error", rec,
						"stack", string(debug.Stack()),
						"path", r.URL.Path,
					)
					http.Error(w, `{"error":"internal","code":"internal"}`, http.StatusInternalServerError)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

func RequestLogger(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			log.InfoContext(r.Context(), "request",
				"method", r.Method,
				"path", r.URL.Path,
				"remote", r.RemoteAddr,
			)
			next.ServeHTTP(w, r)
		})
	}
}

func extractBearer(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return ""
	}
	if !strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		return ""
	}
	return strings.TrimSpace(auth[7:])
}

func isWebSocketUpgrade(r *http.Request) bool {
	if !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
		return false
	}
	connection := strings.ToLower(r.Header.Get("Connection"))
	return strings.Contains(connection, "upgrade")
}

// extractToken returns the access token from Authorization: Bearer, or — for
// WebSocket upgrades only — from ?token= / ?access_token= (browsers cannot set
// Authorization on the WebSocket constructor).
func extractToken(r *http.Request) string {
	if token := extractBearer(r); token != "" {
		return token
	}
	if !isWebSocketUpgrade(r) {
		return ""
	}
	q := r.URL.Query()
	if token := q.Get("token"); token != "" {
		return token
	}
	return q.Get("access_token")
}

func ContextString(ctx context.Context, key ctxKey) string {
	if v, ok := ctx.Value(key).(string); ok {
		return v
	}
	return ""
}

func ContextRoles(ctx context.Context) []string {
	if v, ok := ctx.Value(CtxRoles).([]string); ok {
		return v
	}
	return nil
}
