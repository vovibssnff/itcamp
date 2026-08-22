package service

import (
	"context"
	"errors"
	"log/slog"
	"strconv"
	"time"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
	"github.com/itcamp/ktc/shared/go/audit"
	sharedcache "github.com/itcamp/ktc/shared/go/cache"
)

// ComponentStore — зависимость ComponentService для тестов с mock-ами.
type ComponentStore interface {
	GetByID(ctx context.Context, id string) (domain.ComponentType, error)
	List(ctx context.Context, category, query string, limit, offset int) ([]domain.ComponentType, error)
	Create(ctx context.Context, c domain.ComponentType) error
	Update(ctx context.Context, c domain.ComponentType) error
	Delete(ctx context.Context, id string) error
	Upsert(ctx context.Context, c domain.ComponentType) error
	IsUsedInTemplates(ctx context.Context, id string) (bool, error)
}

type ComponentService struct {
	repo     ComponentStore
	log      *slog.Logger
	cache    *sharedcache.Cache
	cacheTTL time.Duration
}

func NewComponentService(repo ComponentStore) *ComponentService {
	return &ComponentService{repo: repo}
}

// WithAudit задаёт логгер для записи событий аудита.
func (s *ComponentService) WithAudit(log *slog.Logger) *ComponentService {
	s.log = log
	return s
}

func (s *ComponentService) Get(ctx context.Context, id string) (domain.ComponentType, error) {
	if s.cache != nil {
		if cached, err := sharedcache.Get[domain.ComponentType](ctx, s.cache, componentCacheKeyPrefix+id); err == nil {
			return cached, nil
		}
	}
	c, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.ComponentType{}, err
	}
	if s.cache != nil {
		_ = sharedcache.Set(ctx, s.cache, componentCacheKeyPrefix+id, c, s.cacheTTL)
	}
	return c, nil
}

func (s *ComponentService) List(ctx context.Context, category, query string, limit, offset int) ([]domain.ComponentType, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	return s.repo.List(ctx, category, query, limit, offset)
}

func (s *ComponentService) Create(ctx context.Context, c domain.ComponentType) (domain.ComponentType, error) {
	if c.ID == "" {
		return domain.ComponentType{}, domain.ErrComponentNotFound
	}
	if err := s.repo.Create(ctx, c); err != nil {
		return domain.ComponentType{}, err
	}
	s.invalidateCache(ctx, c.ID)
	IncComponentCreated()
	audit.Emit(ctx, s.log, "component.created", "id", c.ID)
	return c, nil
}

func (s *ComponentService) Update(ctx context.Context, c domain.ComponentType) (domain.ComponentType, error) {
	if err := s.repo.Update(ctx, c); err != nil {
		return domain.ComponentType{}, err
	}
	s.invalidateCache(ctx, c.ID)
	audit.Emit(ctx, s.log, "component.updated", "id", c.ID)
	return c, nil
}

func (s *ComponentService) Delete(ctx context.Context, id string) error {
	inUse, err := s.repo.IsUsedInTemplates(ctx, id)
	if err != nil {
		return err
	}
	if inUse {
		return domain.ErrComponentInUse
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.invalidateCache(ctx, id)
	audit.Emit(ctx, s.log, "component.deleted", "id", id)
	return nil
}

func (s *ComponentService) Seed(ctx context.Context, components []domain.ComponentType) error {
	for _, c := range components {
		if err := s.repo.Upsert(ctx, c); err != nil {
			return err
		}
		s.invalidateCache(ctx, c.ID)
	}
	return nil
}

// Import upsert-ит типы компонентов; ошибки по элементам накапливаются в результате.
func (s *ComponentService) Import(ctx context.Context, components []domain.ComponentType) ImportResult {
	result := ImportResult{Errors: []ImportItemError{}}
	seen := make(map[string]int, len(components))

	for i, c := range components {
		if err := ValidateComponent(c); err != nil {
			result.Errors = append(result.Errors, ImportItemError{ID: c.ID, Index: i, Message: err.Error()})
			continue
		}
		if prev, dup := seen[c.ID]; dup {
			result.Errors = append(result.Errors, ImportItemError{
				ID: c.ID, Index: i, Message: "duplicate id in payload (first at index " + strconv.Itoa(prev) + ")",
			})
			continue
		}
		seen[c.ID] = i

		_, err := s.repo.GetByID(ctx, c.ID)
		exists := err == nil
		if err != nil && !errors.Is(err, domain.ErrComponentNotFound) {
			result.Errors = append(result.Errors, ImportItemError{ID: c.ID, Index: i, Message: err.Error()})
			continue
		}
		if err := s.repo.Upsert(ctx, c); err != nil {
			result.Errors = append(result.Errors, ImportItemError{ID: c.ID, Index: i, Message: err.Error()})
			continue
		}
		s.invalidateCache(ctx, c.ID)
		if exists {
			result.Updated++
			audit.Emit(ctx, s.log, "component.imported", "id", c.ID, "action", "updated")
		} else {
			result.Created++
			IncComponentCreated()
			audit.Emit(ctx, s.log, "component.imported", "id", c.ID, "action", "created")
		}
	}
	return result
}
