package service

import (
	"context"
	"log/slog"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
	"github.com/itcamp/ktc/services/constructor/internal/repository"
	"github.com/itcamp/ktc/shared/go/audit"
)

type ComponentService struct {
	repo *repository.ComponentRepo
	log  *slog.Logger
}

func NewComponentService(repo *repository.ComponentRepo) *ComponentService {
	return &ComponentService{repo: repo}
}

// WithAudit задаёт логгер для записи событий аудита.
func (s *ComponentService) WithAudit(log *slog.Logger) *ComponentService {
	s.log = log
	return s
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
	IncComponentCreated()
	audit.Emit(ctx, s.log, "component.created", "id", c.ID)
	return c, nil
}

func (s *ComponentService) Update(ctx context.Context, c domain.ComponentType) (domain.ComponentType, error) {
	if err := s.repo.Update(ctx, c); err != nil {
		return domain.ComponentType{}, err
	}
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
	audit.Emit(ctx, s.log, "component.deleted", "id", id)
	return nil
}

func (s *ComponentService) Seed(ctx context.Context, components []domain.ComponentType) error {
	for _, c := range components {
		if err := s.repo.Upsert(ctx, c); err != nil {
			return err
		}
	}
	return nil
}
