package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/itcamp/ktc/services/gw/internal/config"
)

type IntrospectResponse struct {
	Active  bool     `json:"active"`
	UserID  string   `json:"user_id"`
	Login   string   `json:"login"`
	Roles   []string `json:"roles"`
	TokenID string   `json:"token_id"`
}

type Client struct {
	url     string
	timeout time.Duration
	http    *http.Client
	cache   *tokenCache
	log     *slog.Logger
}

func NewClient(cfg config.AuthClientConfig, log *slog.Logger) *Client {
	return &Client{
		url:     cfg.URL,
		timeout: cfg.Timeout.Std(),
		http: &http.Client{
			Timeout: cfg.Timeout.Std(),
		},
		cache: newTokenCache(cfg.CacheTTL.Std(), cfg.CacheMaxSize),
		log:   log,
	}
}

func (c *Client) Introspect(ctx context.Context, token string) (IntrospectResponse, error) {
	if token == "" {
		return IntrospectResponse{Active: false}, nil
	}

	if cached, ok := c.cache.get(token); ok {
		return cached, nil
	}

	body, _ := json.Marshal(map[string]string{"token": token})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(body))
	if err != nil {
		return IntrospectResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		c.log.Warn("introspect call failed", "error", err)
		return IntrospectResponse{}, fmt.Errorf("introspect: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return IntrospectResponse{}, fmt.Errorf("introspect: status %d", resp.StatusCode)
	}

	var result IntrospectResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return IntrospectResponse{}, fmt.Errorf("introspect decode: %w", err)
	}

	c.cache.set(token, result)
	return result, nil
}

type tokenCache struct {
	mu      sync.RWMutex
	ttl     time.Duration
	maxSize int
	items   map[string]cacheItem
}

type cacheItem struct {
	value IntrospectResponse
	exp   time.Time
}

func newTokenCache(ttl time.Duration, maxSize int) *tokenCache {
	if maxSize <= 0 {
		maxSize = 1000
	}
	if ttl <= 0 {
		ttl = 30 * time.Second
	}
	return &tokenCache{
		ttl:     ttl,
		maxSize: maxSize,
		items:   make(map[string]cacheItem),
	}
}

func (c *tokenCache) get(token string) (IntrospectResponse, bool) {
	c.mu.RLock()
	item, ok := c.items[token]
	c.mu.RUnlock()
	if !ok {
		return IntrospectResponse{}, false
	}
	if time.Now().After(item.exp) {
		c.mu.Lock()
		delete(c.items, token)
		c.mu.Unlock()
		return IntrospectResponse{}, false
	}
	return item.value, true
}

func (c *tokenCache) set(token string, value IntrospectResponse) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.items) >= c.maxSize {
		for k, v := range c.items {
			if time.Now().After(v.exp) {
				delete(c.items, k)
			}
		}
		if len(c.items) >= c.maxSize {
			for k := range c.items {
				delete(c.items, k)
				break
			}
		}
	}
	c.items[token] = cacheItem{
		value: value,
		exp:   time.Now().Add(c.ttl),
	}
}
