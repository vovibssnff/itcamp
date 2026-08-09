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

	"github.com/itcamp/ktc/services/constructor/internal/config"
	"github.com/itcamp/ktc/services/constructor/internal/repository"
	"github.com/itcamp/ktc/services/constructor/internal/server"
	"github.com/itcamp/ktc/services/constructor/internal/service"
	"github.com/itcamp/ktc/services/constructor/seeds"
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

	componentRepo := repository.NewComponentRepo(pg)
	templateRepo := repository.NewTemplateRepo(pg)

	componentSvc := service.NewComponentService(componentRepo)

	validator := service.NewValidator(componentRepo.GetByIDSync)
	exporter := service.NewExporter(componentRepo.GetByIDSync)
	templateSvc := service.NewTemplateService(templateRepo, validator, exporter)

	if cfg.Seed.Enabled {
		log.Info("seeding component library")
		if err := componentSvc.Seed(ctx, seeds.Library()); err != nil {
			log.Error("seed failed", "error", err)
		} else {
			log.Info("seed completed")
		}
	}

	srv := server.New(server.Deps{
		Cfg:        cfg,
		Components: componentSvc,
		Templates:  templateSvc,
		Log:        log,
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

	log.Info("constructor server stopped gracefully")
}
