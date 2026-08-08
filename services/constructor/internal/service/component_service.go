package service

import (
	"context"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
	"github.com/itcamp/ktc/services/constructor/internal/repository"
)

type ComponentService struct {
	repo *repository.ComponentRepo
}

func NewComponentService(repo *repository.ComponentRepo) *ComponentService {
	return &ComponentService{repo: repo}
}

func (s *ComponentService) Get(ctx context.Context, id string) (domain.ComponentType, error) {
	return s.repo.GetByID(ctx, id)
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
	return c, nil
}

func (s *ComponentService) Update(ctx context.Context, c domain.ComponentType) (domain.ComponentType, error) {
	if err := s.repo.Update(ctx, c); err != nil {
		return domain.ComponentType{}, err
	}
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
	return s.repo.Delete(ctx, id)
}

func (s *ComponentService) Seed(ctx context.Context, components []domain.ComponentType) error {
	for _, c := range components {
		if err := s.repo.Upsert(ctx, c); err != nil {
			return err
		}
	}
	return nil
}
