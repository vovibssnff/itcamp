package service

import (
	"context"
	"time"

	sharedcache "github.com/itcamp/ktc/shared/go/cache"
)

const templateCacheKeyPrefix = "constructor:template:"

// WithCache включает Redis-кэширование для Get/Export/ExportFile.
func (s *TemplateService) WithCache(c *sharedcache.Cache, ttl time.Duration) *TemplateService {
	s.cache = c
	s.cacheTTL = ttl
	return s
}

func (s *TemplateService) invalidateTemplateCache(ctx context.Context, id string) {
	if s.cache != nil {
		_ = s.cache.Delete(ctx, templateCacheKeyPrefix+id)
	}
}
