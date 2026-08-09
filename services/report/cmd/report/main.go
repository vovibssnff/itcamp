package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/nats-io/nats.go"

	"github.com/itcamp/ktc/services/report/internal/config"
	"github.com/itcamp/ktc/services/report/internal/domain"
	"github.com/itcamp/ktc/services/report/internal/repository"
	"github.com/itcamp/ktc/services/report/internal/server"
	"github.com/itcamp/ktc/services/report/internal/service"
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

	nc, err := nats.Connect(cfg.NATS.URL)
	if err != nil {
		log.Error("nats connect failed", "error", err)
		os.Exit(1)
	}
	defer nc.Close()

	reportSvc := service.NewReportService(repository.NewReportRepo(pg), log)

	go startNATSConsumer(nc, cfg.NATS, reportSvc, log)

	srv := server.New(server.Deps{Cfg: cfg, Svc: reportSvc, Log: log})

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
	log.Info("report server stopped gracefully")
}

func startNATSConsumer(nc *nats.Conn, cfg config.NATSConfig, svc *service.ReportService, log *slog.Logger) {
	_, err := nc.QueueSubscribe(cfg.ReportTasksSubj, cfg.QueueGroup, func(msg *nats.Msg) {
		var task domain.ReportTask
		if err := json.Unmarshal(msg.Data, &task); err != nil {
			log.Error("unmarshal report task", "error", err)
			return
		}
		log.Info("received report task", "report_id", task.ReportID, "session", task.SessionID)
		if err := svc.ProcessTask(context.Background(), task); err != nil {
			log.Error("report task failed", "report_id", task.ReportID, "error", err)
		}
	})
	if err != nil {
		log.Error("nats subscribe failed", "error", err)
		os.Exit(1)
	}
	log.Info("nats consumer started", "subject", cfg.ReportTasksSubj, "queue", cfg.QueueGroup)
}
