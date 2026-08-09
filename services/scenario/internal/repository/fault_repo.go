package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
)

type FaultRepo struct {
	db *Postgres
}

func NewFaultRepo(pg *Postgres) *FaultRepo {
	return &FaultRepo{db: pg}
}

const faultCols = `fault_id, name, applicable_component_types, description, affected_tags, severity, damage_per_sec`

func (r *FaultRepo) scanFault(row pgx.Row) (domain.Fault, error) {
	var f domain.Fault
	var typesJSON, tagsJSON []byte
	if err := row.Scan(&f.FaultID, &f.Name, &typesJSON, &f.Description, &tagsJSON, &f.Severity, &f.DamagePerSec); err != nil {
		return domain.Fault{}, err
	}
	if err := json.Unmarshal(typesJSON, &f.ApplicableComponentTypes); err != nil {
		return domain.Fault{}, fmt.Errorf("unmarshal applicable_component_types: %w", err)
	}
	if err := json.Unmarshal(tagsJSON, &f.AffectedTags); err != nil {
		return domain.Fault{}, fmt.Errorf("unmarshal affected_tags: %w", err)
	}
	return f, nil
}

func (r *FaultRepo) GetByID(ctx context.Context, faultID string) (domain.Fault, error) {
	row := r.db.Pool.QueryRow(ctx, `SELECT `+faultCols+` FROM faults_catalog WHERE fault_id = $1`, faultID)
	f, err := r.scanFault(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Fault{}, domain.ErrFaultNotFound
	}
	return f, err
}

func (r *FaultRepo) List(ctx context.Context, componentType, severity string) ([]domain.Fault, error) {
	q := `SELECT ` + faultCols + ` FROM faults_catalog`
	args := []any{}
	cond := ""
	if severity != "" {
		cond = " WHERE severity = $1"
		args = append(args, severity)
	}
	q += cond + " ORDER BY name"
	if len(args) == 0 {
		q = `SELECT ` + faultCols + ` FROM faults_catalog ORDER BY name`
	}
	rows, err := r.db.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var faults []domain.Fault
	for rows.Next() {
		f, err := r.scanFault(rows)
		if err != nil {
			return nil, err
		}
		if componentType != "" {
			found := false
			for _, t := range f.ApplicableComponentTypes {
				if t == componentType {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		faults = append(faults, f)
	}
	return faults, rows.Err()
}

func (r *FaultRepo) Upsert(ctx context.Context, f domain.Fault) error {
	typesJSON, _ := json.Marshal(f.ApplicableComponentTypes)
	tagsJSON, _ := json.Marshal(f.AffectedTags)
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO faults_catalog (fault_id, name, applicable_component_types, description, affected_tags, severity, damage_per_sec, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, now())
		ON CONFLICT (fault_id) DO UPDATE SET name = $2, applicable_component_types = $3, description = $4, affected_tags = $5, severity = $6, damage_per_sec = $7`,
		f.FaultID, f.Name, typesJSON, f.Description, tagsJSON, string(f.Severity), f.DamagePerSec)
	return err
}

func (r *FaultRepo) Delete(ctx context.Context, faultID string) error {
	tag, err := r.db.Pool.Exec(ctx, `DELETE FROM faults_catalog WHERE fault_id = $1`, faultID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrFaultNotFound
	}
	return nil
}

var _ = fmt.Sprintf
