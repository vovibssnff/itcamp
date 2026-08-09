package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
)

type ScenarioRepo struct {
	db *Postgres
}

func NewScenarioRepo(pg *Postgres) *ScenarioRepo {
	return &ScenarioRepo{db: pg}
}

const scenarioCols = `id, template_id, name, description, type, start_preset_id, faults, reference_actions, criteria, author_id, created_at, updated_at`

func (r *ScenarioRepo) scanScenario(row pgx.Row) (domain.Scenario, error) {
	var s domain.Scenario
	var faultsJSON, refActionsJSON, criteriaJSON []byte
	if err := row.Scan(&s.ID, &s.TemplateID, &s.Name, &s.Description, &s.Type, &s.StartPresetID, &faultsJSON, &refActionsJSON, &criteriaJSON, &s.AuthorID, &s.CreatedAt, nil); err != nil {
		return domain.Scenario{}, err
	}
	if err := json.Unmarshal(faultsJSON, &s.Faults); err != nil {
		return domain.Scenario{}, fmt.Errorf("unmarshal faults: %w", err)
	}
	if err := json.Unmarshal(refActionsJSON, &s.ReferenceActions); err != nil {
		return domain.Scenario{}, fmt.Errorf("unmarshal reference_actions: %w", err)
	}
	if err := json.Unmarshal(criteriaJSON, &s.Criteria); err != nil {
		return domain.Scenario{}, fmt.Errorf("unmarshal criteria: %w", err)
	}
	return s, nil
}

func (r *ScenarioRepo) GetByID(ctx context.Context, id string) (domain.Scenario, error) {
	row := r.db.Pool.QueryRow(ctx, `SELECT `+scenarioCols+` FROM scenarios WHERE id = $1`, id)
	s, err := r.scanScenario(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Scenario{}, domain.ErrScenarioNotFound
	}
	return s, err
}

func (r *ScenarioRepo) List(ctx context.Context, templateID, scenarioType, query string, limit, offset int) ([]domain.Scenario, error) {
	q := `SELECT ` + scenarioCols + ` FROM scenarios`
	args := []any{}
	cond := ""
	if templateID != "" {
		cond = " WHERE template_id = $1"
		args = append(args, templateID)
	}
	if scenarioType != "" {
		if cond == "" {
			cond = " WHERE"
		} else {
			cond += " AND"
		}
		cond += fmt.Sprintf(" type = $%d", len(args)+1)
		args = append(args, scenarioType)
	}
	if query != "" {
		if cond == "" {
			cond = " WHERE"
		} else {
			cond += " AND"
		}
		cond += fmt.Sprintf(" name ILIKE $%d", len(args)+1)
		args = append(args, "%"+query+"%")
	}
	q += cond + fmt.Sprintf(" ORDER BY name LIMIT $%d OFFSET $%d", len(args)+1, len(args)+2)
	args = append(args, limit, offset)

	rows, err := r.db.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var scenarios []domain.Scenario
	for rows.Next() {
		s, err := r.scanScenario(rows)
		if err != nil {
			return nil, err
		}
		scenarios = append(scenarios, s)
	}
	return scenarios, rows.Err()
}

func (r *ScenarioRepo) Create(ctx context.Context, s domain.Scenario) error {
	faultsJSON, _ := json.Marshal(s.Faults)
	refActionsJSON, _ := json.Marshal(s.ReferenceActions)
	criteriaJSON, _ := json.Marshal(s.Criteria)
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO scenarios (id, template_id, name, description, type, start_preset_id, faults, reference_actions, criteria, author_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())`,
		s.ID, s.TemplateID, s.Name, s.Description, string(s.Type), s.StartPresetID, faultsJSON, refActionsJSON, criteriaJSON, s.AuthorID)
	return err
}

func (r *ScenarioRepo) Upsert(ctx context.Context, s domain.Scenario) error {
	faultsJSON, _ := json.Marshal(s.Faults)
	refActionsJSON, _ := json.Marshal(s.ReferenceActions)
	criteriaJSON, _ := json.Marshal(s.Criteria)
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO scenarios (id, template_id, name, description, type, start_preset_id, faults, reference_actions, criteria, author_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
		ON CONFLICT (id) DO UPDATE SET name = $3, description = $4, type = $5, faults = $7, reference_actions = $8, criteria = $9, updated_at = now()`,
		s.ID, s.TemplateID, s.Name, s.Description, string(s.Type), s.StartPresetID, faultsJSON, refActionsJSON, criteriaJSON, s.AuthorID)
	return err
}

func (r *ScenarioRepo) Update(ctx context.Context, s domain.Scenario) error {
	faultsJSON, _ := json.Marshal(s.Faults)
	refActionsJSON, _ := json.Marshal(s.ReferenceActions)
	criteriaJSON, _ := json.Marshal(s.Criteria)
	tag, err := r.db.Pool.Exec(ctx, `
		UPDATE scenarios SET name = $2, description = $3, type = $4, start_preset_id = $5, faults = $6, reference_actions = $7, criteria = $8, updated_at = now()
		WHERE id = $1`,
		s.ID, s.Name, s.Description, string(s.Type), s.StartPresetID, faultsJSON, refActionsJSON, criteriaJSON)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrScenarioNotFound
	}
	return nil
}

func (r *ScenarioRepo) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Pool.Exec(ctx, `DELETE FROM scenarios WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrScenarioNotFound
	}
	return nil
}

func (r *ScenarioRepo) GetRandomExam(ctx context.Context, templateID string) (domain.Scenario, error) {
	row := r.db.Pool.QueryRow(ctx, `
		SELECT `+scenarioCols+` FROM scenarios WHERE type = 'exam' AND (template_id = $1 OR template_id = '')
		ORDER BY RANDOM() LIMIT 1`, templateID)
	s, err := r.scanScenario(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Scenario{}, domain.ErrScenarioNotFound
	}
	return s, err
}

func (r *ScenarioRepo) Clone(ctx context.Context, id, newTemplateID string) (domain.Scenario, error) {
	original, err := r.GetByID(ctx, id)
	if err != nil {
		return domain.Scenario{}, err
	}
	clone := original
	clone.ID = newUUID()
	clone.TemplateID = newTemplateID
	clone.Name = original.Name + " (копия)"
	if err := r.Create(ctx, clone); err != nil {
		return domain.Scenario{}, err
	}
	return clone, nil
}
