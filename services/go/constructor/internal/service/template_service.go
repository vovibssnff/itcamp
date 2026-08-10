package service

import (
	"context"
	"log/slog"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
	"github.com/itcamp/ktc/services/constructor/internal/repository"
	"github.com/itcamp/ktc/shared/go/audit"
)

type TemplateService struct {
	repo      *repository.TemplateRepo
	validator *Validator
	exporter  *Exporter
	log       *slog.Logger
}

func NewTemplateService(repo *repository.TemplateRepo, validator *Validator, exporter *Exporter) *TemplateService {
	return &TemplateService{repo: repo, validator: validator, exporter: exporter}
}

// WithAudit задаёт логгер для записи событий аудита.
func (s *TemplateService) WithAudit(log *slog.Logger) *TemplateService {
	s.log = log
	return s
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
	audit.Emit(ctx, s.log, "template.created", "id", t.ID, "status", t.Status)
	return t, nil
}

func (s *TemplateService) Update(ctx context.Context, t domain.Template) (domain.Template, error) {
	existing, err := s.repo.GetByID(ctx, t.ID)
	if err != nil {
		return domain.Template{}, err
	}
	// PUT body omits status; preserve the stored lifecycle state instead of
	// silently demoting published/archived templates back to draft.
	t = mergeTemplateUpdate(existing, t)
	if err := s.repo.Update(ctx, t); err != nil {
		return domain.Template{}, err
	}
	audit.Emit(ctx, s.log, "template.updated", "id", t.ID)
	return s.repo.GetByID(ctx, t.ID)
}

// mergeTemplateUpdate fills blank update fields from the persisted template.
func mergeTemplateUpdate(existing, incoming domain.Template) domain.Template {
	if incoming.Status == "" {
		incoming.Status = existing.Status
	}
	if incoming.Graph.SchemaVersion == "" {
		if existing.Graph.SchemaVersion != "" {
			incoming.Graph.SchemaVersion = existing.Graph.SchemaVersion
		} else {
			incoming.Graph.SchemaVersion = "2.0"
		}
	}
	return incoming
}

func (s *TemplateService) Delete(ctx context.Context, id string, force bool) error {
	if !force {
		if err := s.repo.UpdateStatus(ctx, id, domain.StatusArchived); err != nil {
			return err
		}
		audit.Emit(ctx, s.log, "template.archived", "id", id)
		return nil
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	audit.Emit(ctx, s.log, "template.deleted", "id", id)
	return nil
}

func (s *TemplateService) Copy(ctx context.Context, id, newName string) (domain.Template, error) {
	clone, err := s.repo.DeepClone(ctx, id, newName)
	if err != nil {
		return domain.Template{}, err
	}
	audit.Emit(ctx, s.log, "template.copied", "source_id", id, "new_id", clone.ID)
	return clone, nil
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
	state, err := s.exporter.Export(t.Graph)
	if err != nil {
		return nil, err
	}
	audit.Emit(ctx, s.log, "template.exported", "id", id)
	return state, nil
}
