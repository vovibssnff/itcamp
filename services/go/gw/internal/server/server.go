package server

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/itcamp/ktc/services/gw/internal/auth"
	"github.com/itcamp/ktc/services/gw/internal/config"
	"github.com/itcamp/ktc/services/gw/internal/middleware"
	"github.com/itcamp/ktc/services/gw/internal/proxy"
	sharedmetrics "github.com/itcamp/ktc/shared/go/pkg/metrics"
)

type Deps struct {
	Cfg      config.Config
	Auth     *auth.Client
	Registry *proxy.Registry
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

	h := middleware.Recover(d.Log)(mux)
	h = sharedmetrics.Middleware(h)
	h = middleware.RequestLogger(d.Log)(h)
	h = middleware.RateLimit(d.Cfg.Security.RateLimitPerMin, d.Log)(h)

	srv := &http.Server{
		Addr:         d.Cfg.HTTP.Addr,
		Handler:      h,
		ReadTimeout:  d.Cfg.HTTP.ReadTimeout.Std(),
		WriteTimeout: d.Cfg.HTTP.WriteTimeout.Std(),
	}

	return &Server{cfg: d.Cfg, log: d.Log, server: srv}
}

func registerRoutes(mux *http.ServeMux, d Deps) {
	for _, route := range d.Cfg.Routes {
		proxyHandler := d.Registry.ProxyHandler(route)

		h := middleware.InjectHeaders(proxyHandler)

		// RequireRoles must wrap inside Auth so it runs after introspect
		// populates ContextRoles. Last Wrap is outermost: Auth → Roles → proxy.
		if len(route.Roles) > 0 {
			h = middleware.RequireRoles(route.Roles...)(h)
		}

		if route.Auth {
			h = middleware.AuthMiddleware(d.Auth, d.Log)(h)
		}

		pattern := route.Prefix
		if !strings.HasSuffix(pattern, "/") {
			pattern = pattern + "/"
		}
		pattern = pattern + "{path...}"

		mux.HandleFunc(pattern, h.ServeHTTP)
		mux.HandleFunc(route.Prefix, h.ServeHTTP)
	}

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.Handle("GET /metrics", sharedmetrics.Handler())
}

func (s *Server) Run() error {
	s.log.Info("starting gw server", "addr", s.cfg.HTTP.Addr)
	if err := s.server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	shutdownCtx, cancel := context.WithTimeout(ctx, s.cfg.HTTP.ShutdownTimeout.Std())
	defer cancel()
	s.log.Info("shutting down gw server")
	return s.server.Shutdown(shutdownCtx)
}
