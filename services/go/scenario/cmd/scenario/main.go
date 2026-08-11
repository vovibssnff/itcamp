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
	"time"

	sharedcache "github.com/itcamp/ktc/shared/go/cache"

	"github.com/itcamp/ktc/services/scenario/internal/config"
	"github.com/itcamp/ktc/services/scenario/internal/repository"
	"github.com/itcamp/ktc/services/scenario/internal/server"
	"github.com/itcamp/ktc/services/scenario/internal/service"
	"github.com/itcamp/ktc/services/scenario/seeds"
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

	scenarioRepo := repository.NewScenarioRepo(pg)
	faultRepo := repository.NewFaultRepo(pg)

	var cacheClient *sharedcache.Cache
	if cfg.Redis.Addr != "" {
		cacheClient, err = sharedcache.New(ctx, cfg.Redis.Addr, cfg.Redis.Password, cfg.Redis.DB)
		if err != nil {
			log.Error("redis init failed, caching disabled", "error", err)
		} else {
			defer cacheClient.Close()
			log.Info("redis cache connected", "addr", cfg.Redis.Addr)
		}
	}

	triggerValidator := service.NewTriggerValidator()
	scenarioSvc := service.NewScenarioService(scenarioRepo, triggerValidator).WithAudit(log)
	if cacheClient != nil {
		scenarioSvc = scenarioSvc.WithCache(cacheClient, cacheTTL(cfg.Redis.TTL))
	}
	faultSvc := service.NewFaultService(faultRepo)
	if cacheClient != nil {
		faultSvc = faultSvc.WithCache(cacheClient, cacheTTL(cfg.Redis.TTL))
	}

	if cfg.Seed.Enabled {
		log.Info("seeding faults catalog")
		if err := faultSvc.Seed(ctx, seeds.FaultsCatalog()); err != nil {
			log.Error("faults seed failed", "error", err)
		}
		log.Info("seeding scenarios")
		if err := scenarioSvc.Seed(ctx, seeds.DemoScenarios()); err != nil {
			log.Error("scenarios seed failed", "error", err)
		}
		log.Info("seed completed")
	}

	srv := server.New(server.Deps{
		Cfg:       cfg,
		Scenarios: scenarioSvc,
		Faults:    faultSvc,
		Log:       log,
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

	log.Info("scenario server stopped gracefully")
}

func cacheTTL(d config.Duration) time.Duration {
	if d.Std() > 0 {
		return d.Std()
	}
	return 5 * time.Minute
}
