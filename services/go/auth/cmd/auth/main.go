package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/itcamp/ktc/services/auth/internal/config"
	"github.com/itcamp/ktc/services/auth/internal/repository"
	"github.com/itcamp/ktc/services/auth/internal/security"
	"github.com/itcamp/ktc/services/auth/internal/server"
	"github.com/itcamp/ktc/services/auth/internal/service"
)

func main() {
	configPath := flag.String("config", "config.toml", "path to TOML config file")
	flag.Parse()

	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Error("config load failed", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pg, err := repository.NewPostgres(ctx, cfg.DB)
	if err != nil {
		log.Error("db init failed", "error", err)
		os.Exit(1)
	}
	defer pg.Close()

	userRepo := repository.NewUserRepo(pg)
	refreshRepo := repository.NewRefreshRepo(pg)
	mfaRepo := repository.NewMFARepo(pg)
	attemptRepo := repository.NewLoginAttemptRepo(pg)

	mode := cfg.Auth.Mode
	if mode == "" {
		mode = "ldap"
	}
	var authenticator security.Authenticator
	switch mode {
	case "stub":
		stub, err := security.NewStubAuthenticator(cfg.Auth.StubUsers)
		if err != nil {
			log.Error("stub authenticator init failed", "error", err)
			os.Exit(1)
		}
		authenticator = stub
		log.Info("running in STUB mode (no LDAP)")
	case "ldap":
		authenticator = security.NewLDAPClient(cfg.LDAP)
		log.Info("running in LDAP mode")
	default:
		log.Error("unknown auth mode", "mode", mode)
		os.Exit(1)
	}

	totpKey := cfg.Security.TOTPEncryptionKey
	if totpKey == "" {
		totpKey = cfg.JWT.SigningKey
	}
	totpSvc, err := security.NewTOTPService([]byte(totpKey))
	if err != nil {
		log.Error("totp init failed", "error", err)
		os.Exit(1)
	}

	auditSvc := service.NewAuditService(log)
	tokenSvc := service.NewTokenService(cfg.JWT, refreshRepo, userRepo)
	mfaSvc := service.NewMFAService(mfaRepo, userRepo, totpSvc, auditSvc)
	authSvc := service.NewAuthService(cfg.Security, userRepo, authenticator, tokenSvc, mfaSvc, attemptRepo, auditSvc, log)
	userSvc := service.NewUserService(userRepo, auditSvc)
	introspectSvc := service.NewIntrospectService(tokenSvc)

	srv := server.New(server.Deps{
		Cfg:      cfg,
		Auth:     authSvc,
		Tokens:   tokenSvc,
		Users:    userSvc,
		MFA:      mfaSvc,
		Internal: introspectSvc,
		Audit:    auditSvc,
		Log:      log,
	})

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	errCh := make(chan error, 1)
	go func() {
		if err := srv.Run(); err != nil {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server error", "error", err)
			os.Exit(1)
		}
	case sig := <-stop:
		log.Info("signal received, shutting down", "signal", sig.String())
	}

	shutdownCtx, shutdownCancel := context.WithCancel(context.Background())
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("shutdown failed", "error", err)
		os.Exit(1)
	}

	log.Info("server stopped gracefully")
}
