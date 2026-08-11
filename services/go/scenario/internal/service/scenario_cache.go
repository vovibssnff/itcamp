package service

import (
	"context"
	"time"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
	sharedcache "github.com/itcamp/ktc/shared/go/cache"
)

const scenarioCacheKeyPrefix = "scenario:full:"

// WithCache включает Redis-кэширование для Get/GetFull.
func (s *ScenarioService) WithCache(c *sharedcache.Cache, ttl time.Duration) *ScenarioService {
	s.cache = c
	s.cacheTTL = ttl
	return s
}

func (s *ScenarioService) invalidateCache(ctx context.Context, id string) {
	if s.cache != nil {
		_ = s.cache.Delete(ctx, scenarioCacheKeyPrefix+id)
	}
}

// cachedGet возвращает сценарий из кэша или БД.
func (s *ScenarioService) cachedGet(ctx context.Context, id string) (domain.Scenario, error) {
	if s.cache != nil {
		if cached, err := sharedcache.Get[domain.Scenario](ctx, s.cache, scenarioCacheKeyPrefix+id); err == nil {
			return cached, nil
		}
	}
	sc, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.Scenario{}, err
	}
	if s.cache != nil {
		_ = sharedcache.Set(ctx, s.cache, scenarioCacheKeyPrefix+id, sc, s.cacheTTL)
	}
	return sc, nil
}
