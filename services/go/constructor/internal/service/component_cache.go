package service

import (
	"context"
	"time"

	"github.com/itcamp/ktc/services/constructor/internal/domain"

	sharedcache "github.com/itcamp/ktc/shared/go/cache"
)

const componentCacheKeyPrefix = "constructor:component:"

// WithCache включает Redis-кэширование для Get/GetSync.
func (s *ComponentService) WithCache(c *sharedcache.Cache, ttl time.Duration) *ComponentService {
	s.cache = c
	s.cacheTTL = ttl
	return s
}

// GetSync возвращает тип компонента для синхронных вызовов (валидатор, экспортёр).
// При включённом кэше читает из Redis, при промахе — из БД.
func (s *ComponentService) GetSync(id string) (domain.ComponentType, bool) {
	ctx := context.Background()
	if s.cache != nil {
		if cached, err := sharedcache.Get[domain.ComponentType](ctx, s.cache, componentCacheKeyPrefix+id); err == nil {
			return cached, true
		}
	}
	c, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.ComponentType{}, false
	}
	if s.cache != nil {
		_ = sharedcache.Set(ctx, s.cache, componentCacheKeyPrefix+id, c, s.cacheTTL)
	}
	return c, true
}

// invalidateCache удаляет запись из кэша при Create/Update/Delete.
func (s *ComponentService) invalidateCache(ctx context.Context, id string) {
	if s.cache != nil {
		_ = s.cache.Delete(ctx, componentCacheKeyPrefix+id)
	}
}
