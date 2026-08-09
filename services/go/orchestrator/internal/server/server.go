package server

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"runtime/debug"

	"github.com/itcamp/ktc/services/orchestrator/internal/config"
	"github.com/itcamp/ktc/services/orchestrator/internal/service"
	"github.com/itcamp/ktc/services/orchestrator/internal/transport/http/handler"
	"github.com/itcamp/ktc/shared/go/audit"
)

type Deps struct {
	Cfg      config.Config
	Sessions *service.SessionService
	Hub      *service.WSHub
	Log      *slog.Logger
}

type Server struct {
	cfg    config.Config
	log    *slog.Logger
	server *http.Server
}

func New(d Deps) *Server {
	mux := http.NewServeMux()
	registerRoutes(mux, d)

	h := recoverMiddleware(d.Log)(mux)
	h = requestLogger(d.Log)(h)
	h = actorMiddleware(h)

	srv := &http.Server{
		Addr:         d.Cfg.HTTP.Addr,
		Handler:      h,
		ReadTimeout:  d.Cfg.HTTP.ReadTimeout.Std(),
		WriteTimeout: d.Cfg.HTTP.WriteTimeout.Std(),
	}
	return &Server{cfg: d.Cfg, log: d.Log, server: srv}
}

func registerRoutes(mux *http.ServeMux, d Deps) {
	sh := handler.NewSessionHandler(d.Sessions, d.Hub)

	mux.HandleFunc("GET /sessions", sh.List)
	mux.HandleFunc("POST /sessions", sh.Create)
	mux.HandleFunc("GET /sessions/{id}", sh.Get)
	mux.HandleFunc("POST /sessions/{id}/start", sh.Start)
	mux.HandleFunc("POST /sessions/{id}/pause", sh.Pause)
	mux.HandleFunc("POST /sessions/{id}/stop", sh.Stop)
	mux.HandleFunc("PUT /sessions/{id}/speed", sh.Speed)
	mux.HandleFunc("POST /sessions/{id}/checkpoint", sh.Checkpoint)
	mux.HandleFunc("POST /sessions/{id}/restore", sh.Restore)
	mux.HandleFunc("POST /sessions/{id}/actuator", sh.Actuator)
	mux.HandleFunc("POST /sessions/{id}/alarms/{alarm_id}/ack", sh.AckAlarm)

	mux.HandleFunc("GET /ws/sessions/{id}/operator", sh.WSOperator)
	mux.HandleFunc("GET /ws/sessions/{id}/observe", sh.WSObserve)

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
}

func recoverMiddleware(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					log.ErrorContext(r.Context(), "panic recovered",
						"error", rec, "stack", string(debug.Stack()), "path", r.URL.Path)
					http.Error(w, `{"error":"internal","code":"internal"}`, http.StatusInternalServerError)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

func requestLogger(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			log.InfoContext(r.Context(), "request", "method", r.Method, "path", r.URL.Path)
			next.ServeHTTP(w, r)
		})
	}
}

// actorMiddleware кладёт идентификатор актора из заголовка X-User-ID в контекст
// для фиксации его в событиях аудита.
func actorMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r.WithContext(audit.WithActor(r.Context(), r.Header.Get("X-User-ID"))))
	})
}

func (s *Server) Run() error {
	s.log.Info("starting orchestrator server", "addr", s.cfg.HTTP.Addr)
	if err := s.server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	shutdownCtx, cancel := context.WithTimeout(ctx, s.cfg.HTTP.ShutdownTimeout.Std())
	defer cancel()
	s.log.Info("shutting down orchestrator server")
	return s.server.Shutdown(shutdownCtx)
}
