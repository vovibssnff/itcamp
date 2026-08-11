package middleware

import (
	"context"
	"net/http"
	"runtime/debug"

	"log/slog"

	"github.com/itcamp/ktc/services/auth/internal/domain"
)

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

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
					http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				}
			}()
			next.ServeHTTP(&statusWriter{ResponseWriter: w, status: http.StatusOK}, r)
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

type ctxKey string

const (
	CtxUserID ctxKey = "user_id"
	CtxRoles  ctxKey = "roles"
	CtxIP     ctxKey = "ip"
)

func ContextValue(ctx context.Context, key ctxKey) string {
	if v, ok := ctx.Value(key).(string); ok {
		return v
	}
	return ""
}

func ContextUserID(ctx context.Context) string {
	return ContextValue(ctx, CtxUserID)
}

func ContextRoles(ctx context.Context) []domain.Role {
	if v, ok := ctx.Value(CtxRoles).([]domain.Role); ok {
		return v
	}
	return nil
}

// clientIP извлекает IP клиента. Предпочитается X-Real-IP (выставляется
// доверенным прокси), затем RemoteAddr. X-Forwarded-For не используется
// напрямую — его может подделать клиент.
func clientIP(r *http.Request) string {
	if real := r.Header.Get("X-Real-IP"); real != "" {
		return real
	}
	return r.RemoteAddr
}
