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

	"github.com/itcamp/ktc/services/sim-manager/internal/config"
	"github.com/itcamp/ktc/services/sim-manager/internal/provider"
	"github.com/itcamp/ktc/services/sim-manager/internal/server"
	"github.com/itcamp/ktc/services/sim-manager/internal/service"
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

	var p provider.RuntimeProvider
	switch cfg.Provider.Type {
	case "docker":
		dp, err := provider.NewDockerProvider(ctx, cfg.Provider.DockerHost, cfg.Provider.WorkerImage, cfg.Provider.Network, cfg.Provider.CPURequest, cfg.Provider.MemRequest, cfg.Provider.WorkerPort, log)
		if err != nil {
			log.Error("docker provider init failed", "error", err)
			os.Exit(1)
		}
		p = dp
		log.Info("using Docker provider")
	default:
		p = provider.NewInMemoryProvider(cfg.Provider.WorkerPort)
		log.Info("using in-memory provider (no real sim-worker containers)")
	}

	svc := service.NewManagerService(
		p,
		cfg.Provider.MaxInstances,
		cfg.Provider.WorkerImage,
		cfg.Provider.CPURequest,
		cfg.Provider.MemRequest,
		log,
	)

	srv := server.New(server.Deps{Cfg: cfg, Svc: svc, Log: log})

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
	log.Info("sim-manager stopped gracefully")
}
