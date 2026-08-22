package service

import (
	"context"
	"errors"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
	"github.com/itcamp/ktc/shared/go/audit"
	sharedcache "github.com/itcamp/ktc/shared/go/cache"
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
	cache     *sharedcache.Cache
	cacheTTL  time.Duration
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
	return s.cachedGet(ctx, id)
}

func (s *ScenarioService) GetFull(ctx context.Context, id string) (domain.Scenario, error) {
	return s.cachedGet(ctx, id)
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
	IncScenarioCreated(string(sc.Type))
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
	s.invalidateCache(ctx, sc.ID)
	IncScenarioUpdated()
	audit.Emit(ctx, s.log, "scenario.updated", "id", sc.ID)
	return s.repo.GetByID(ctx, sc.ID)
}

func (s *ScenarioService) Delete(ctx context.Context, id string) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.invalidateCache(ctx, id)
	IncScenarioDeleted()
	audit.Emit(ctx, s.log, "scenario.deleted", "id", id)
	return nil
}

func (s *ScenarioService) Clone(ctx context.Context, id, newTemplateID string) (domain.Scenario, error) {
	clone, err := s.repo.Clone(ctx, id, newTemplateID)
	if err != nil {
		return domain.Scenario{}, err
	}
	IncScenarioCloned()
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
		s.invalidateCache(ctx, sc.ID)
	}
	return nil
}

// Import upsert-ит сценарии с валидацией; ошибки по элементам накапливаются в результате.
func (s *ScenarioService) Import(ctx context.Context, scenarios []domain.Scenario) ImportResult {
	result := ImportResult{Errors: []ImportItemError{}}
	seen := make(map[string]int, len(scenarios))

	for i, sc := range scenarios {
		if sc.ID == "" {
			sc.ID = newUUID()
		}
		if sc.Type == "" {
			sc.Type = domain.ScenarioTraining
		}
		if prev, dup := seen[sc.ID]; dup {
			result.Errors = append(result.Errors, ImportItemError{
				ID: sc.ID, Index: i,
				Message: "duplicate id in payload (first at index " + strconv.Itoa(prev) + ")",
			})
			continue
		}
		seen[sc.ID] = i

		if err := s.validator.ValidateScenario(sc); err != nil {
			result.Errors = append(result.Errors, ImportItemError{ID: sc.ID, Index: i, Message: err.Error()})
			continue
		}
		if strings.TrimSpace(sc.TemplateID) == "" {
			result.Errors = append(result.Errors, ImportItemError{ID: sc.ID, Index: i, Message: "template_id is required"})
			continue
		}

		_, err := s.repo.GetByID(ctx, sc.ID)
		exists := err == nil
		if err != nil && !errors.Is(err, domain.ErrScenarioNotFound) {
			result.Errors = append(result.Errors, ImportItemError{ID: sc.ID, Index: i, Message: err.Error()})
			continue
		}
		if err := s.repo.Upsert(ctx, sc); err != nil {
			result.Errors = append(result.Errors, ImportItemError{ID: sc.ID, Index: i, Message: err.Error()})
			continue
		}
		s.invalidateCache(ctx, sc.ID)
		if exists {
			result.Updated++
			audit.Emit(ctx, s.log, "scenario.imported", "id", sc.ID, "action", "updated")
		} else {
			result.Created++
			IncScenarioCreated(string(sc.Type))
			audit.Emit(ctx, s.log, "scenario.imported", "id", sc.ID, "action", "created")
		}
	}
	return result
}
