package service

import (
	"context"
	"time"

	sharedcache "github.com/itcamp/ktc/shared/go/cache"
)

const faultsCatalogKey = "scenario:faults:catalog"

// WithCache включает Redis-кэширование для List (каталог неисправностей).
func (s *FaultService) WithCache(c *sharedcache.Cache, ttl time.Duration) *FaultService {
	s.cache = c
	s.cacheTTL = ttl
	return s
}

func (s *FaultService) invalidateFaultsCache(ctx context.Context) {
	if s.cache != nil {
		_ = s.cache.Delete(ctx, faultsCatalogKey)
	}
}
