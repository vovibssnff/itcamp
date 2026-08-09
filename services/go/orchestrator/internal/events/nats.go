package events

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/nats-io/nats.go"

	"github.com/itcamp/ktc/services/orchestrator/internal/config"
)

type Publisher struct {
	nc  *nats.Conn
	log *slog.Logger
}

func New(ctx context.Context, cfg config.NATSConfig, log *slog.Logger) (*Publisher, error) {
	nc, err := nats.Connect(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("nats connect: %w", err)
	}
	log.Info("connected to NATS", "url", cfg.URL)
	return &Publisher{nc: nc, log: log}, nil
}

func (p *Publisher) Close() {
	if p.nc != nil {
		p.nc.Close()
	}
}

func (p *Publisher) PublishSessionEvent(ctx context.Context, sessionID, event string, data any) error {
	subject := "session.events." + sessionID
	payload, _ := json.Marshal(map[string]any{
		"session_id": sessionID,
		"event":      event,
		"data":       data,
	})
	if err := p.nc.Publish(subject, payload); err != nil {
		return fmt.Errorf("nats publish %s: %w", subject, err)
	}
	return nil
}

func (p *Publisher) PublishReportTask(ctx context.Context, reportID, sessionID, reportType string) error {
	subject := "report.tasks"
	payload, _ := json.Marshal(map[string]any{
		"report_id":  reportID,
		"session_id": sessionID,
		"type":       reportType,
	})
	return p.nc.Publish(subject, payload)
}

func (p *Publisher) PublishAITask(ctx context.Context, taskID, sessionID, kind string, payload any) error {
	subject := "ai.tasks"
	data, _ := json.Marshal(map[string]any{
		"task_id":    taskID,
		"session_id": sessionID,
		"kind":       kind,
		"payload":    payload,
	})
	return p.nc.Publish(subject, data)
}
