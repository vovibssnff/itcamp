package service

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
	sharedcache "github.com/itcamp/ktc/shared/go/cache"
)

// FaultStore — зависимость FaultService для тестов с mock-ами.
type FaultStore interface {
	GetByID(ctx context.Context, faultID string) (domain.Fault, error)
	List(ctx context.Context, componentType, severity string) ([]domain.Fault, error)
	Upsert(ctx context.Context, f domain.Fault) error
}

type FaultService struct {
	repo     FaultStore
	cache    *sharedcache.Cache
	cacheTTL time.Duration
}

func NewFaultService(repo FaultStore) *FaultService {
	return &FaultService{repo: repo}
}

func (s *FaultService) Get(ctx context.Context, faultID string) (domain.Fault, error) {
	return s.repo.GetByID(ctx, faultID)
}

func (s *FaultService) List(ctx context.Context, componentType, severity string) ([]domain.Fault, error) {
	if s.cache != nil && componentType == "" && severity == "" {
		if cached, err := sharedcache.Get[[]domain.Fault](ctx, s.cache, faultsCatalogKey); err == nil {
			return cached, nil
		}
	}
	faults, err := s.repo.List(ctx, componentType, severity)
	if err != nil {
		return nil, err
	}
	if s.cache != nil && componentType == "" && severity == "" {
		_ = sharedcache.Set(ctx, s.cache, faultsCatalogKey, faults, s.cacheTTL)
	}
	return faults, nil
}

func (s *FaultService) Seed(ctx context.Context, faults []domain.Fault) error {
	for _, f := range faults {
		if err := s.repo.Upsert(ctx, f); err != nil {
			return err
		}
	}
	s.invalidateFaultsCache(ctx)
	return nil
}

// Import upsert-ит неисправности; ошибки по элементам накапливаются в результате.
func (s *FaultService) Import(ctx context.Context, faults []domain.Fault) ImportResult {
	result := ImportResult{Errors: []ImportItemError{}}
	seen := make(map[string]int, len(faults))

	for i, f := range faults {
		if err := ValidateFault(f); err != nil {
			result.Errors = append(result.Errors, ImportItemError{ID: f.FaultID, Index: i, Message: err.Error()})
			continue
		}
		if prev, dup := seen[f.FaultID]; dup {
			result.Errors = append(result.Errors, ImportItemError{
				ID: f.FaultID, Index: i,
				Message: "duplicate fault_id in payload (first at index " + strconv.Itoa(prev) + ")",
			})
			continue
		}
		seen[f.FaultID] = i

		_, err := s.repo.GetByID(ctx, f.FaultID)
		exists := err == nil
		if err != nil && !errors.Is(err, domain.ErrFaultNotFound) {
			result.Errors = append(result.Errors, ImportItemError{ID: f.FaultID, Index: i, Message: err.Error()})
			continue
		}
		if err := s.repo.Upsert(ctx, f); err != nil {
			result.Errors = append(result.Errors, ImportItemError{ID: f.FaultID, Index: i, Message: err.Error()})
			continue
		}
		s.invalidateFaultsCache(ctx)
		if exists {
			result.Updated++
		} else {
			result.Created++
		}
	}
	return result
}
