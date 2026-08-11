package service

import (
	"context"
	"log/slog"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
	"github.com/itcamp/ktc/shared/go/audit"
)

// TemplateStore — зависимость TemplateService для тестов с mock-ами.
type TemplateStore interface {
	GetByID(ctx context.Context, id string) (domain.Template, error)
	List(ctx context.Context, authorID, status, query string, limit, offset int) ([]domain.Template, error)
	Create(ctx context.Context, t domain.Template) error
	Update(ctx context.Context, t domain.Template) error
	UpdateStatus(ctx context.Context, id string, status domain.TemplateStatus) error
	Delete(ctx context.Context, id string) error
	DeepClone(ctx context.Context, id, newName string) (domain.Template, error)
}

type TemplateService struct {
	repo      TemplateStore
	validator *Validator
	exporter  *Exporter
	log       *slog.Logger
}

func NewTemplateService(repo TemplateStore, validator *Validator, exporter *Exporter) *TemplateService {
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
	IncTemplateCreated(string(t.Status))
	audit.Emit(ctx, s.log, "template.created", "id", t.ID, "status", t.Status)
	return t, nil
}

func (s *TemplateService) Update(ctx context.Context, t domain.Template) (domain.Template, error) {
	if t.Status == "" {
		t.Status = domain.StatusDraft
	}
	if t.Graph.SchemaVersion == "" {
		t.Graph.SchemaVersion = "2.0"
	}
	if err := s.repo.Update(ctx, t); err != nil {
		return domain.Template{}, err
	}
	IncTemplateUpdated()
	audit.Emit(ctx, s.log, "template.updated", "id", t.ID)
	return s.repo.GetByID(ctx, t.ID)
}

func (s *TemplateService) Delete(ctx context.Context, id string, force bool) error {
	if !force {
		if err := s.repo.UpdateStatus(ctx, id, domain.StatusArchived); err != nil {
			return err
		}
		IncTemplateDeleted(false)
		audit.Emit(ctx, s.log, "template.archived", "id", id)
		return nil
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	IncTemplateDeleted(true)
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
	result := s.validator.Validate(t.Graph)
	if result.Valid {
		IncTemplateValidation("valid")
	} else {
		IncTemplateValidation("invalid")
	}
	return result, nil
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

// TemplateImportResult — созданный шаблон и результат валидации графа.
type TemplateImportResult struct {
	Template   domain.Template         `json:"template"`
	Validation domain.ValidationResult `json:"validation"`
}

// Import создаёт draft-шаблон и возвращает валидацию графа (даже если граф невалиден).
func (s *TemplateService) Import(ctx context.Context, t domain.Template) (TemplateImportResult, error) {
	created, err := s.Create(ctx, t)
	if err != nil {
		return TemplateImportResult{}, err
	}
	validation := s.validator.Validate(created.Graph)
	if validation.Valid {
		IncTemplateValidation("valid")
	} else {
		IncTemplateValidation("invalid")
	}
	audit.Emit(ctx, s.log, "template.imported", "id", created.ID)
	return TemplateImportResult{Template: created, Validation: validation}, nil
}

// ExportFile возвращает граф шаблона для скачивания (не sim init-state).
// Seed upserts templates that don't yet exist (skip if id already present).
func (s *TemplateService) Seed(ctx context.Context, templates []domain.Template) error {
	for _, t := range templates {
		if _, err := s.repo.GetByID(ctx, t.ID); err == nil {
			continue // already exists
		}
		if _, err := s.Create(ctx, t); err != nil {
			return err
		}
	}
	return nil
}

func (s *TemplateService) ExportFile(ctx context.Context, id string) (domain.Graph, error) {
	t, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.Graph{}, err
	}
	return t.Graph, nil
}
