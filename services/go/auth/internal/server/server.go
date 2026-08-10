package server

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	sharedmetrics "github.com/itcamp/ktc/shared/go/pkg/metrics"

	"github.com/itcamp/ktc/services/auth/internal/config"
	"github.com/itcamp/ktc/services/auth/internal/service"
	"github.com/itcamp/ktc/services/auth/internal/transport/http/handler"
	"github.com/itcamp/ktc/services/auth/internal/transport/http/middleware"
)

type Deps struct {
	Cfg      config.Config
	Auth     *service.AuthService
	Tokens   *service.TokenService
	Users    *service.UserService
	MFA      *service.MFAService
	Internal *service.IntrospectService
	Audit    *service.AuditService
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
	h = middleware.RateLimit(d.Cfg.Security.AuthRateLimit, d.Cfg.Security.RateLimitWindow.Std(), d.Log)(h)

	srv := &http.Server{
		Addr:         d.Cfg.HTTP.Addr,
		Handler:      h,
		ReadTimeout:  d.Cfg.HTTP.ReadTimeout.Std(),
		WriteTimeout: d.Cfg.HTTP.WriteTimeout.Std(),
	}

	return &Server{cfg: d.Cfg, log: d.Log, server: srv}
}

func registerRoutes(mux *http.ServeMux, d Deps) {
	authH := handler.NewAuthHandler(d.Auth, d.Tokens)
	mfaH := handler.NewMFAHandler(d.MFA)
	meH := handler.NewMeHandler(d.Users)
	introH := handler.NewIntrospectHandler(d.Internal)
	userH := handler.NewUserHandler(d.Users)

	auth := middleware.Auth(d.Internal)

	mux.HandleFunc("POST /login", authH.Login)
	mux.HandleFunc("POST /refresh", authH.Refresh)
	mux.HandleFunc("POST /logout", authH.Logout)
	mux.HandleFunc("POST /mfa/enrollment", authH.Enrollment)

	mux.Handle("GET /me", auth(http.HandlerFunc(meH.Me)))

	mux.HandleFunc("POST /introspect", introH.Introspect)

	mux.Handle("GET /users", auth(http.HandlerFunc(userH.List)))
	mux.Handle("GET /users/{id}", auth(http.HandlerFunc(userH.Get)))

	mux.Handle("POST /users/{userID}/mfa/setup", auth(http.HandlerFunc(mfaH.Setup)))
	mux.Handle("POST /users/{userID}/mfa/enable", auth(http.HandlerFunc(mfaH.Enable)))
	mux.Handle("POST /users/{userID}/mfa/disable", auth(http.HandlerFunc(mfaH.Disable)))
	mux.Handle("GET /users/{userID}/mfa", auth(http.HandlerFunc(mfaH.Status)))

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.Handle("GET /metrics", sharedmetrics.Handler())
}

func (s *Server) Run() error {
	s.log.Info("starting http server", "addr", s.cfg.HTTP.Addr)
	if err := s.server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	shutdownCtx, cancel := context.WithTimeout(ctx, s.cfg.HTTP.ShutdownTimeout.Std())
	defer cancel()
	s.log.Info("shutting down http server")
	return s.server.Shutdown(shutdownCtx)
}

var _ = time.Second
