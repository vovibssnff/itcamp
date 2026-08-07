package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/itcamp/ktc/services/auth/internal/domain"
)

type MFARepo struct {
	db *Postgres
}

func NewMFARepo(pg *Postgres) *MFARepo {
	return &MFARepo{db: pg}
}

type MFARecord struct {
	UserID      string
	SecretEnc   []byte
	Enabled     bool
}

func (r *MFARepo) Get(ctx context.Context, userID string) (MFARecord, error) {
	var rec MFARecord
	err := r.db.Pool.QueryRow(ctx, `
		SELECT user_id, secret_enc, enabled FROM mfa_secrets WHERE user_id = $1`, userID).
		Scan(&rec.UserID, &rec.SecretEnc, &rec.Enabled)
	if errors.Is(err, pgx.ErrNoRows) {
		return MFARecord{}, domain.ErrMFANotEnabled
	}
	return rec, err
}

func (r *MFARepo) Upsert(ctx context.Context, rec MFARecord) error {
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO mfa_secrets (user_id, secret_enc, enabled, created_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (user_id) DO UPDATE SET secret_enc = $2, enabled = $3`,
		rec.UserID, rec.SecretEnc, rec.Enabled)
	return err
}

func (r *MFARepo) SetEnabled(ctx context.Context, userID string, enabled bool) error {
	tag, err := r.db.Pool.Exec(ctx, `UPDATE mfa_secrets SET enabled = $2 WHERE user_id = $1`, userID, enabled)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrMFANotEnabled
	}
	return nil
}

func (r *MFARepo) Delete(ctx context.Context, userID string) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM mfa_secrets WHERE user_id = $1`, userID)
	return err
}
