// Package cache предоставляет обёртку над Redis для кэширования
// редко меняющихся объектов (типы компонентов, шаблоны, сценарии).
// Использует JSON-сериализацию и TTL-based инвалидацию.
package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Cache — обёртка над Redis-клиентом с generic Get/Set.
type Cache struct {
	rdb *redis.Client
}

// New создаёт подключение к Redis и проверяет доступность.
func New(ctx context.Context, addr, password string, db int) (*Cache, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}
	return &Cache{rdb: rdb}, nil
}

// Close закрывает подключение.
func (c *Cache) Close() {
	if c.rdb != nil {
		_ = c.rdb.Close()
	}
}

// Get возвращает объект по ключу. ErrNotFound — если ключа нет в кэше.
func Get[T any](ctx context.Context, c *Cache, key string) (T, error) {
	var zero T
	data, err := c.rdb.Get(ctx, key).Bytes()
	if errors.Is(err, redis.Nil) {
		return zero, ErrNotFound
	}
	if err != nil {
		return zero, err
	}
	var v T
	if err := json.Unmarshal(data, &v); err != nil {
		return zero, fmt.Errorf("cache unmarshal: %w", err)
	}
	return v, nil
}

// Set сохраняет объект в кэш с TTL.
func Set[T any](ctx context.Context, c *Cache, key string, v T, ttl time.Duration) error {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("cache marshal: %w", err)
	}
	return c.rdb.Set(ctx, key, data, ttl).Err()
}

// Delete удаляет ключ(и) из кэша.
func (c *Cache) Delete(ctx context.Context, keys ...string) error {
	return c.rdb.Del(ctx, keys...).Err()
}

// ErrNotFound возвращается при промахе кэша.
var ErrNotFound = errors.New("cache: key not found")
