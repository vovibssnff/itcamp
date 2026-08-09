package cache

import (
	"context"
	"encoding/json"
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
		c.rdb.Close()
	}
}

func (c *Cache) SaveTelemetry(ctx context.Context, sessionID string, t domain.Telemetry) error {
	data, _ := json.Marshal(t)
	key := "telemetry:" + sessionID
	return c.rdb.Set(ctx, key, data, 10*time.Second).Err()
}

func (c *Cache) GetTelemetry(ctx context.Context, sessionID string) (domain.Telemetry, error) {
	data, err := c.rdb.Get(ctx, "telemetry:"+sessionID).Bytes()
	if err != nil {
		return domain.Telemetry{}, err
	}
	var t domain.Telemetry
	json.Unmarshal(data, &t)
	return t, nil
}

func (c *Cache) SaveSessionState(ctx context.Context, sessionID string, s domain.Session) error {
	data, _ := json.Marshal(s)
	key := "session:" + sessionID
	return c.rdb.Set(ctx, key, data, 0).Err()
}

func (c *Cache) GetSessionState(ctx context.Context, sessionID string) (domain.Session, error) {
	data, err := c.rdb.Get(ctx, "session:"+sessionID).Bytes()
	if err != nil {
		return domain.Session{}, err
	}
	var s domain.Session
	json.Unmarshal(data, &s)
	return s, nil
}

func (c *Cache) DeleteSessionState(ctx context.Context, sessionID string) error {
	return c.rdb.Del(ctx, "session:"+sessionID).Err()
}
