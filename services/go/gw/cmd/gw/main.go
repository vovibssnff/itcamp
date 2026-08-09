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

	"github.com/itcamp/ktc/services/gw/internal/auth"
	"github.com/itcamp/ktc/services/gw/internal/config"
	"github.com/itcamp/ktc/services/gw/internal/proxy"
	"github.com/itcamp/ktc/services/gw/internal/server"
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

	registry, err := proxy.NewRegistry(cfg.Upstreams)
	if err != nil {
		log.Error("proxy registry init failed", "error", err)
		os.Exit(1)
	}

	authClient := auth.NewClient(cfg.Auth, log)

	srv := server.New(server.Deps{
		Cfg:      cfg,
		Auth:     authClient,
		Registry: registry,
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

	log.Info("gw server stopped gracefully")
}
