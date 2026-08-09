package server

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"runtime/debug"

	"github.com/itcamp/ktc/services/report/internal/config"
	"github.com/itcamp/ktc/services/report/internal/service"
	"github.com/itcamp/ktc/services/report/internal/transport/http/handler"
)

type Deps struct {
	Cfg config.Config
	Svc *service.ReportService
	Log *slog.Logger
}

type Server struct {
	cfg    config.Config
	log    *slog.Logger
	server *http.Server
}

func New(d Deps) *Server {
	mux := http.NewServeMux()
	registerRoutes(mux, d)
	h := recoverMW(d.Log)(mux)
	h = logMW(d.Log)(h)
	srv := &http.Server{
		Addr: d.Cfg.HTTP.Addr, Handler: h,
		ReadTimeout:  d.Cfg.HTTP.ReadTimeout.Std(),
		WriteTimeout: d.Cfg.HTTP.WriteTimeout.Std(),
	}
	return &Server{cfg: d.Cfg, log: d.Log, server: srv}
}

func registerRoutes(mux *http.ServeMux, d Deps) {
	h := handler.NewReportHandler(d.Svc)
	mux.HandleFunc("POST /reports", h.Create)
	mux.HandleFunc("GET /reports", h.List)
	mux.HandleFunc("GET /reports/{id}", h.Get)
	mux.HandleFunc("GET /reports/{id}/download", h.Download)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
}

func recoverMW(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					log.ErrorContext(r.Context(), "panic", "error", rec, "stack", string(debug.Stack()))
					http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

func logMW(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			log.InfoContext(r.Context(), "request", "method", r.Method, "path", r.URL.Path)
			next.ServeHTTP(w, r)
		})
	}
}

func (s *Server) Run() error {
	s.log.Info("starting report server", "addr", s.cfg.HTTP.Addr)
	if err := s.server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	ctx2, cancel := context.WithTimeout(ctx, s.cfg.HTTP.ShutdownTimeout.Std())
	defer cancel()
	s.log.Info("shutting down report server")
	return s.server.Shutdown(ctx2)
}
