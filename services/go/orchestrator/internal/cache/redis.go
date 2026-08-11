package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/itcamp/ktc/services/orchestrator/internal/config"
	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

type Cache struct {
	rdb *redis.Client
}

func New(ctx context.Context, cfg config.RedisConfig) (*Cache, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Addr,
		Password: cfg.Password,
		DB:       cfg.DB,
	})
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}
	return &Cache{rdb: rdb}, nil
}

func (c *Cache) Close() {
	if c.rdb != nil {
		_ = c.rdb.Close()
	}
}

const telemetryTTL = 10 * time.Second

func (c *Cache) SaveTelemetry(ctx context.Context, sessionID string, t domain.Telemetry) error {
	data, _ := json.Marshal(t)
	key := "telemetry:" + sessionID
	return c.rdb.Set(ctx, key, data, telemetryTTL).Err()
}

func (c *Cache) GetTelemetry(ctx context.Context, sessionID string) (domain.Telemetry, error) {
	data, err := c.rdb.Get(ctx, "telemetry:"+sessionID).Bytes()
	if errors.Is(err, redis.Nil) {
		return domain.Telemetry{}, domain.ErrTelemetryNotFound
	}
	if err != nil {
		return domain.Telemetry{}, err
	}
	var t domain.Telemetry
	if err := json.Unmarshal(data, &t); err != nil {
		return domain.Telemetry{}, fmt.Errorf("unmarshal telemetry: %w", err)
	}
	return t, nil
}

func (c *Cache) DeleteTelemetry(ctx context.Context, sessionID string) error {
	return c.rdb.Del(ctx, "telemetry:"+sessionID).Err()
}

func (c *Cache) SaveSessionState(ctx context.Context, sessionID string, s domain.Session) error {
	data, _ := json.Marshal(s)
	key := "session:" + sessionID
	return c.rdb.Set(ctx, key, data, 0).Err()
}

func (c *Cache) GetSessionState(ctx context.Context, sessionID string) (domain.Session, error) {
	data, err := c.rdb.Get(ctx, "session:"+sessionID).Bytes()
	if errors.Is(err, redis.Nil) {
		return domain.Session{}, domain.ErrSessionNotFound
	}
	if err != nil {
		return domain.Session{}, err
	}
	var s domain.Session
	if err := json.Unmarshal(data, &s); err != nil {
		return domain.Session{}, fmt.Errorf("unmarshal session: %w", err)
	}
	return s, nil
}

func (c *Cache) DeleteSessionState(ctx context.Context, sessionID string) error {
	return c.rdb.Del(ctx, "session:"+sessionID).Err()
}
