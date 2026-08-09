package service

import (
	"context"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
	"github.com/itcamp/ktc/services/constructor/internal/repository"
)

type TemplateService struct {
	repo      *repository.TemplateRepo
	validator *Validator
	exporter  *Exporter
}

func NewTemplateService(repo *repository.TemplateRepo, validator *Validator, exporter *Exporter) *TemplateService {
	return &TemplateService{repo: repo, validator: validator, exporter: exporter}
}

func (s *TemplateService) Get(ctx context.Context, id string) (domain.Template, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *TemplateService) List(ctx context.Context, authorID, status, query string, limit, offset int) ([]domain.Template, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	return s.repo.List(ctx, authorID, status, query, limit, offset)
}

func (s *TemplateService) Create(ctx context.Context, t domain.Template) (domain.Template, error) {
	if t.ID == "" {
		t.ID = newUUID()
	}
	if t.Status == "" {
		t.Status = domain.StatusDraft
	}
	if t.Graph.SchemaVersion == "" {
		t.Graph.SchemaVersion = "2.0"
	}
	if err := s.repo.Create(ctx, t); err != nil {
		return domain.Template{}, err
	}
	return t, nil
}

func (s *TemplateService) Update(ctx context.Context, t domain.Template) (domain.Template, error) {
	if err := s.repo.Update(ctx, t); err != nil {
		return domain.Template{}, err
	}
	return s.repo.GetByID(ctx, t.ID)
}

func (s *TemplateService) Delete(ctx context.Context, id string, force bool) error {
	if !force {
		return s.repo.UpdateStatus(ctx, id, domain.StatusArchived)
	}
	return s.repo.Delete(ctx, id)
}

func (s *TemplateService) Copy(ctx context.Context, id, newName string) (domain.Template, error) {
	return s.repo.DeepClone(ctx, id, newName)
}

func (s *TemplateService) Validate(ctx context.Context, id string) (domain.ValidationResult, error) {
	t, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.ValidationResult{}, err
	}
	return s.validator.Validate(t.Graph), nil
}

func (s *TemplateService) Export(ctx context.Context, id string) (map[string]any, error) {
	t, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.exporter.Export(t.Graph)
}
