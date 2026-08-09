// Package db предоставляет единый бустстрап пула соединений PostgreSQL (pgx)
// с проверкой доступности (ping) и одинаковой конфигурацией для всех сервисов.
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DB — пул соединений PostgreSQL.
type DB struct {
	Pool *pgxpool.Pool
}

// New создаёт пул соединений и проверяет доступность БД (ping).
func New(ctx context.Context, dsn string, maxConns, minConns int32, connTimeout time.Duration) (*DB, error) {
	pcfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse dsn: %w", err)
	}
	pcfg.MaxConns = maxConns
	pcfg.MinConns = minConns

	pool, err := pgxpool.NewWithConfig(ctx, pcfg)
	if err != nil {
		return nil, fmt.Errorf("pgxpool new: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, connTimeout)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return &DB{Pool: pool}, nil
}

// Close закрывает пул соединений.
func (d *DB) Close() {
	if d.Pool != nil {
		d.Pool.Close()
	}
}
