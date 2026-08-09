package repository

import (
	"context"

	"github.com/itcamp/ktc/shared/go/db"

	"github.com/itcamp/ktc/services/orchestrator/internal/config"
)

// Postgres — пул соединений PostgreSQL.
// Тип-алиас на общий пакет db (единый бустстрап пула для всех сервисов).
type Postgres = db.DB

// NewPostgres создаёт пул соединений и проверяет доступность БД.
func NewPostgres(ctx context.Context, cfg config.DBConfig) (*Postgres, error) {
	return db.New(ctx, cfg.DSN, cfg.MaxConns, cfg.MinConns, cfg.ConnTimeout.Std())
}
