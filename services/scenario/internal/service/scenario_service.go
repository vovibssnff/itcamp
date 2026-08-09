package service

import (
	"context"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
	"github.com/itcamp/ktc/services/scenario/internal/repository"
)

type ScenarioService struct {
	repo      *repository.ScenarioRepo
	validator *TriggerValidator
}

func NewScenarioService(repo *repository.ScenarioRepo, validator *TriggerValidator) *ScenarioService {
	return &ScenarioService{repo: repo, validator: validator}
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
	return sc, nil
}

func (s *ScenarioService) Update(ctx context.Context, sc domain.Scenario) (domain.Scenario, error) {
	if err := s.validator.ValidateScenario(sc); err != nil {
		return domain.Scenario{}, err
	}
	if err := s.repo.Update(ctx, sc); err != nil {
		return domain.Scenario{}, err
	}
	return s.repo.GetByID(ctx, sc.ID)
}

func (s *ScenarioService) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *ScenarioService) Clone(ctx context.Context, id, newTemplateID string) (domain.Scenario, error) {
	return s.repo.Clone(ctx, id, newTemplateID)
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
