package service

import (
	"context"
	"log/slog"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
	"github.com/itcamp/ktc/shared/go/audit"
)

type ScenarioStore interface {
	GetByID(ctx context.Context, id string) (domain.Scenario, error)
	List(ctx context.Context, templateID, scenarioType, query string, limit, offset int) ([]domain.Scenario, error)
	Create(ctx context.Context, s domain.Scenario) error
	Upsert(ctx context.Context, s domain.Scenario) error
	Update(ctx context.Context, s domain.Scenario) error
	Delete(ctx context.Context, id string) error
	GetRandomExam(ctx context.Context, templateID string) (domain.Scenario, error)
	Clone(ctx context.Context, id, newTemplateID string) (domain.Scenario, error)
}

type ScenarioService struct {
	repo      ScenarioStore
	validator *TriggerValidator
	log       *slog.Logger
}

func NewScenarioService(repo ScenarioStore, validator *TriggerValidator) *ScenarioService {
	return &ScenarioService{repo: repo, validator: validator}
}

// WithAudit задаёт логгер для записи событий аудита.
func (s *ScenarioService) WithAudit(log *slog.Logger) *ScenarioService {
	s.log = log
	return s
}

func (s *ScenarioService) Get(ctx context.Context, id string) (domain.Scenario, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *ScenarioService) GetFull(ctx context.Context, id string) (domain.Scenario, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *ScenarioService) List(ctx context.Context, templateID, scenarioType, query string, limit, offset int) ([]domain.Scenario, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	return s.repo.List(ctx, templateID, scenarioType, query, limit, offset)
}

func (s *ScenarioService) Create(ctx context.Context, sc domain.Scenario) (domain.Scenario, error) {
	if sc.ID == "" {
		sc.ID = newUUID()
	}
	if sc.Type == "" {
		sc.Type = domain.ScenarioTraining
	}
	if err := s.validator.ValidateScenario(sc); err != nil {
		return domain.Scenario{}, err
	}
	if err := s.repo.Create(ctx, sc); err != nil {
		return domain.Scenario{}, err
	}
	audit.Emit(ctx, s.log, "scenario.created", "id", sc.ID, "type", sc.Type)
	return sc, nil
}

func (s *ScenarioService) Update(ctx context.Context, sc domain.Scenario) (domain.Scenario, error) {
	if err := s.validator.ValidateScenario(sc); err != nil {
		return domain.Scenario{}, err
	}
	if err := s.repo.Update(ctx, sc); err != nil {
		return domain.Scenario{}, err
	}
	audit.Emit(ctx, s.log, "scenario.updated", "id", sc.ID)
	return s.repo.GetByID(ctx, sc.ID)
}

func (s *ScenarioService) Delete(ctx context.Context, id string) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	audit.Emit(ctx, s.log, "scenario.deleted", "id", id)
	return nil
}

func (s *ScenarioService) Clone(ctx context.Context, id, newTemplateID string) (domain.Scenario, error) {
	clone, err := s.repo.Clone(ctx, id, newTemplateID)
	if err != nil {
		return domain.Scenario{}, err
	}
	audit.Emit(ctx, s.log, "scenario.cloned", "source_id", id, "new_id", clone.ID, "template_id", newTemplateID)
	return clone, nil
}

func (s *ScenarioService) GetRandomExam(ctx context.Context, templateID string) (domain.Scenario, error) {
	return s.repo.GetRandomExam(ctx, templateID)
}

func (s *ScenarioService) Seed(ctx context.Context, scenarios []domain.Scenario) error {
	for _, sc := range scenarios {
		if err := s.repo.Upsert(ctx, sc); err != nil {
			return err
		}
	}
	return nil
}
