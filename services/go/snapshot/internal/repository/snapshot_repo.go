package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/itcamp/ktc/services/snapshot/internal/domain"
)

type SnapshotRepo struct {
	db *Postgres
}

func NewSnapshotRepo(pg *Postgres) *SnapshotRepo {
	return &SnapshotRepo{db: pg}
}

const snapshotCols = `id, session_id, name, model_time, author_id, schema_version, sha256, storage_key, is_preset, created_at`

func (r *SnapshotRepo) scanMeta(row pgx.Row) (domain.SnapshotMeta, error) {
	var m domain.SnapshotMeta
	if err := row.Scan(&m.ID, &m.SessionID, &m.Name, &m.ModelTime, &m.AuthorID, &m.SchemaVersion, &m.SHA256, &m.StorageKey, &m.IsPreset, &m.CreatedAt); err != nil {
		return domain.SnapshotMeta{}, err
	}
	return m, nil
}

func (r *SnapshotRepo) GetByID(ctx context.Context, id string) (domain.SnapshotMeta, error) {
	row := r.db.Pool.QueryRow(ctx, `SELECT `+snapshotCols+` FROM snapshots WHERE id = $1`, id)
	m, err := r.scanMeta(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.SnapshotMeta{}, domain.ErrSnapshotNotFound
	}
	return m, err
}

func (r *SnapshotRepo) List(ctx context.Context, sessionID string, isPreset *bool, limit, offset int) ([]domain.SnapshotMeta, error) {
	q := `SELECT ` + snapshotCols + ` FROM snapshots`
	args := []any{}
	cond := ""
	if sessionID != "" {
		cond = " WHERE session_id = $1"
		args = append(args, sessionID)
	}
	if isPreset != nil {
		if cond == "" {
			cond = " WHERE"
		} else {
			cond += " AND"
		}
		cond += " is_preset = $" + itoa(len(args)+1)
		args = append(args, *isPreset)
	}
	q += cond + " ORDER BY created_at DESC LIMIT $" + itoa(len(args)+1) + " OFFSET $" + itoa(len(args)+2)
	args = append(args, limit, offset)

	rows, err := r.db.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var snapshots []domain.SnapshotMeta
	for rows.Next() {
		m, err := r.scanMeta(rows)
		if err != nil {
			return nil, err
		}
		snapshots = append(snapshots, m)
	}
	return snapshots, rows.Err()
}

func (r *SnapshotRepo) Create(ctx context.Context, m domain.SnapshotMeta) error {
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO snapshots (id, session_id, name, model_time, author_id, schema_version, sha256, storage_key, is_preset, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
		m.ID, m.SessionID, m.Name, m.ModelTime, m.AuthorID, m.SchemaVersion, m.SHA256, m.StorageKey, m.IsPreset)
	return err
}

func (r *SnapshotRepo) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Pool.Exec(ctx, `DELETE FROM snapshots WHERE id = $1 AND is_preset = FALSE`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrSnapshotNotFound
	}
	return nil
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [10]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
