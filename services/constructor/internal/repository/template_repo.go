package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
)

type TemplateRepo struct {
	db *Postgres
}

func NewTemplateRepo(pg *Postgres) *TemplateRepo {
	return &TemplateRepo{db: pg}
}

const templateCols = `id, name, description, author_id, status, graph, created_at, updated_at`

func (r *TemplateRepo) scanTemplate(row pgx.Row) (domain.Template, error) {
	var t domain.Template
	var graphJSON []byte
	if err := row.Scan(&t.ID, &t.Name, &t.Description, &t.AuthorID, &t.Status, &graphJSON, &t.CreatedAt, &t.UpdatedAt); err != nil {
		return domain.Template{}, err
	}
	if err := json.Unmarshal(graphJSON, &t.Graph); err != nil {
		return domain.Template{}, fmt.Errorf("unmarshal graph: %w", err)
	}
	return t, nil
}

func (r *TemplateRepo) GetByID(ctx context.Context, id string) (domain.Template, error) {
	row := r.db.Pool.QueryRow(ctx, `SELECT `+templateCols+` FROM installation_templates WHERE id = $1`, id)
	t, err := r.scanTemplate(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Template{}, domain.ErrTemplateNotFound
	}
	return t, err
}

func (r *TemplateRepo) List(ctx context.Context, authorID, status, query string, limit, offset int) ([]domain.Template, error) {
	q := `SELECT ` + templateCols + ` FROM installation_templates`
	args := []any{}
	cond := ""
	if authorID != "" {
		cond = " WHERE author_id = $1"
		args = append(args, authorID)
	}
	if status != "" {
		if cond == "" {
			cond = " WHERE"
		} else {
			cond += " AND"
		}
		cond += fmt.Sprintf(" status = $%d", len(args)+1)
		args = append(args, status)
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
	q += cond + fmt.Sprintf(" ORDER BY updated_at DESC LIMIT $%d OFFSET $%d", len(args)+1, len(args)+2)
	args = append(args, limit, offset)

	rows, err := r.db.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var templates []domain.Template
	for rows.Next() {
		t, err := r.scanTemplate(rows)
		if err != nil {
			return nil, err
		}
		templates = append(templates, t)
	}
	return templates, rows.Err()
}

func (r *TemplateRepo) Create(ctx context.Context, t domain.Template) error {
	graphJSON, _ := json.Marshal(t.Graph)
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO installation_templates (id, name, description, author_id, status, graph, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
		t.ID, t.Name, t.Description, t.AuthorID, string(t.Status), graphJSON)
	return err
}

func (r *TemplateRepo) Update(ctx context.Context, t domain.Template) error {
	graphJSON, _ := json.Marshal(t.Graph)
	tag, err := r.db.Pool.Exec(ctx, `
		UPDATE installation_templates SET name = $2, description = $3, status = $4, graph = $5, updated_at = now()
		WHERE id = $1`,
		t.ID, t.Name, t.Description, string(t.Status), graphJSON)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrTemplateNotFound
	}
	return nil
}

func (r *TemplateRepo) UpdateStatus(ctx context.Context, id string, status domain.TemplateStatus) error {
	tag, err := r.db.Pool.Exec(ctx, `UPDATE installation_templates SET status = $2, updated_at = now() WHERE id = $1`, id, string(status))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrTemplateNotFound
	}
	return nil
}

func (r *TemplateRepo) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Pool.Exec(ctx, `DELETE FROM installation_templates WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrTemplateNotFound
	}
	return nil
}

func (r *TemplateRepo) DeepClone(ctx context.Context, id, newName string) (domain.Template, error) {
	t, err := r.GetByID(ctx, id)
	if err != nil {
		return domain.Template{}, err
	}
	clone := domain.Template{
		ID:          newUUID(),
		Name:        newName,
		Description: t.Description,
		AuthorID:    t.AuthorID,
		Status:      domain.StatusDraft,
		Graph:       t.Graph,
	}
	if err := r.Create(ctx, clone); err != nil {
		return domain.Template{}, err
	}
	return clone, nil
}
