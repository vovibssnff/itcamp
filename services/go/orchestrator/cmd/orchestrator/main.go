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

	"github.com/itcamp/ktc/services/orchestrator/internal/cache"
	"github.com/itcamp/ktc/services/orchestrator/internal/client"
	"github.com/itcamp/ktc/services/orchestrator/internal/config"
	"github.com/itcamp/ktc/services/orchestrator/internal/events"
	"github.com/itcamp/ktc/services/orchestrator/internal/repository"
	"github.com/itcamp/ktc/services/orchestrator/internal/server"
	"github.com/itcamp/ktc/services/orchestrator/internal/service"
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

	redisCache, err := cache.New(ctx, cfg.Redis)
	if err != nil {
		log.Error("redis init failed", "error", err)
		os.Exit(1)
	}
	defer redisCache.Close()

	publisher, err := events.New(ctx, cfg.NATS, log)
	if err != nil {
		log.Error("nats init failed", "error", err)
		os.Exit(1)
	}
	defer publisher.Close()

	simClient := client.NewMockSimClient()
	assessmentClient := client.NewMockAssessmentClient()
	snapshotClient := client.NewMockSnapshotClient()

	hub := service.NewWSHub()
	sessionRepo := repository.NewSessionRepo(pg)

	sessionSvc := service.NewSessionService(
		sessionRepo, redisCache, publisher,
		simClient, assessmentClient, snapshotClient,
		nil, nil,
		hub, log,
	)

	srv := server.New(server.Deps{
		Cfg:      cfg,
		Sessions: sessionSvc,
		Hub:      hub,
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

	log.Info("orchestrator server stopped gracefully")
}
