package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
)

type ComponentRepo struct {
	db *Postgres
}

func NewComponentRepo(pg *Postgres) *ComponentRepo {
	return &ComponentRepo{db: pg}
}

const componentCols = `id, name, category, description, ports, parameters, model_code, icon_s3_key, documentation, created_at, updated_at`

func (r *ComponentRepo) scanComponent(row pgx.Row) (domain.ComponentType, error) {
	var c domain.ComponentType
	var portsJSON, paramsJSON []byte
	if err := row.Scan(&c.ID, &c.Name, &c.Category, &c.Description, &portsJSON, &paramsJSON, &c.ModelCode, &c.IconS3Key, &c.Documentation, nil, nil); err != nil {
		return domain.ComponentType{}, err
	}
	if err := json.Unmarshal(portsJSON, &c.Ports); err != nil {
		return domain.ComponentType{}, fmt.Errorf("unmarshal ports: %w", err)
	}
	if err := json.Unmarshal(paramsJSON, &c.Parameters); err != nil {
		return domain.ComponentType{}, fmt.Errorf("unmarshal parameters: %w", err)
	}
	return c, nil
}

func (r *ComponentRepo) GetByID(ctx context.Context, id string) (domain.ComponentType, error) {
	row := r.db.Pool.QueryRow(ctx, `SELECT `+componentCols+` FROM component_types WHERE id = $1`, id)
	c, err := r.scanComponent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ComponentType{}, domain.ErrComponentNotFound
	}
	return c, err
}

func (r *ComponentRepo) GetByIDSync(id string) (domain.ComponentType, bool) {
	c, err := r.GetByID(context.Background(), id)
	if err != nil {
		return domain.ComponentType{}, false
	}
	return c, true
}

func (r *ComponentRepo) List(ctx context.Context, category, query string, limit, offset int) ([]domain.ComponentType, error) {
	q := `SELECT ` + componentCols + ` FROM component_types`
	args := []any{}
	cond := ""
	if category != "" {
		cond = " WHERE category = $1"
		args = append(args, category)
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
	var components []domain.ComponentType
	for rows.Next() {
		c, err := r.scanComponent(rows)
		if err != nil {
			return nil, err
		}
		components = append(components, c)
	}
	return components, rows.Err()
}

func (r *ComponentRepo) Create(ctx context.Context, c domain.ComponentType) error {
	portsJSON, _ := json.Marshal(c.Ports)
	paramsJSON, _ := json.Marshal(c.Parameters)
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO component_types (id, name, category, description, ports, parameters, model_code, icon_s3_key, documentation, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())`,
		c.ID, c.Name, c.Category, c.Description, portsJSON, paramsJSON, c.ModelCode, c.IconS3Key, c.Documentation)
	if isUniqueViolation(err) {
		return fmt.Errorf("%w: id %s already exists", domain.ErrComponentNotFound, c.ID)
	}
	return err
}

func (r *ComponentRepo) Upsert(ctx context.Context, c domain.ComponentType) error {
	portsJSON, _ := json.Marshal(c.Ports)
	paramsJSON, _ := json.Marshal(c.Parameters)
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO component_types (id, name, category, description, ports, parameters, model_code, icon_s3_key, documentation, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
		ON CONFLICT (id) DO UPDATE SET name = $2, category = $3, description = $4, ports = $5, parameters = $6, model_code = $7, icon_s3_key = $8, documentation = $9, updated_at = now()`,
		c.ID, c.Name, c.Category, c.Description, portsJSON, paramsJSON, c.ModelCode, c.IconS3Key, c.Documentation)
	return err
}

func (r *ComponentRepo) Update(ctx context.Context, c domain.ComponentType) error {
	portsJSON, _ := json.Marshal(c.Ports)
	paramsJSON, _ := json.Marshal(c.Parameters)
	tag, err := r.db.Pool.Exec(ctx, `
		UPDATE component_types SET name = $2, category = $3, description = $4, ports = $5, parameters = $6, model_code = $7, icon_s3_key = $8, documentation = $9, updated_at = now()
		WHERE id = $1`,
		c.ID, c.Name, c.Category, c.Description, portsJSON, paramsJSON, c.ModelCode, c.IconS3Key, c.Documentation)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrComponentNotFound
	}
	return nil
}

func (r *ComponentRepo) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Pool.Exec(ctx, `DELETE FROM component_types WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrComponentNotFound
	}
	return nil
}

func (r *ComponentRepo) IsUsedInTemplates(ctx context.Context, id string) (bool, error) {
	var count int
	err := r.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM installation_templates
		WHERE graph @> jsonb_build_object('nodes', jsonb_build_array(jsonb_build_object('component_type_id', $1::text)))`,
		id).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}
