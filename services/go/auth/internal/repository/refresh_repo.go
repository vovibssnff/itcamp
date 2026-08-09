package repository

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/itcamp/ktc/services/auth/internal/domain"
)

type RefreshRepo struct {
	db *Postgres
}

func NewRefreshRepo(pg *Postgres) *RefreshRepo {
	return &RefreshRepo{db: pg}
}

func (r *RefreshRepo) Create(ctx context.Context, t domain.RefreshToken) error {
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO refresh_tokens (id, user_id, login, roles, token_hash, issued_at, expires_at, revoked, replaced_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		t.ID, t.UserID, t.Login, rolesToJSON(t.Roles), t.TokenHash, t.IssuedAt, t.ExpiresAt, t.Revoked, nullIfEmpty(t.ReplacedBy))
	return err
}

func (r *RefreshRepo) GetByHash(ctx context.Context, hash string) (domain.RefreshToken, error) {
	var t domain.RefreshToken
	var rolesJSON []byte
	var replacedBy *string
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, user_id, login, roles, token_hash, issued_at, expires_at, revoked, replaced_by
		FROM refresh_tokens WHERE token_hash = $1`, hash).
		Scan(&t.ID, &t.UserID, &t.Login, &rolesJSON, &t.TokenHash, &t.IssuedAt, &t.ExpiresAt, &t.Revoked, &replacedBy)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.RefreshToken{}, domain.ErrTokenRevoked
	}
	if replacedBy != nil {
		t.ReplacedBy = *replacedBy
	}
	json.Unmarshal(rolesJSON, &t.Roles)
	return t, err
}

func (r *RefreshRepo) Revoke(ctx context.Context, id string) error {
	tag, err := r.db.Pool.Exec(ctx, `UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrTokenRevoked
	}
	return nil
}

func (r *RefreshRepo) RevokeAndReplace(ctx context.Context, oldID, newID string) error {
	tag, err := r.db.Pool.Exec(ctx, `
		UPDATE refresh_tokens SET revoked = TRUE, replaced_by = $2 WHERE id = $1 AND revoked = FALSE`,
		oldID, newID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrTokenRevoked
	}
	return nil
}

func (r *RefreshRepo) RevokeAllForUser(ctx context.Context, userID string) error {
	_, err := r.db.Pool.Exec(ctx, `UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE`, userID)
	return err
}

func (r *RefreshRepo) CleanupExpired(ctx context.Context, before time.Time) (int64, error) {
	tag, err := r.db.Pool.Exec(ctx, `DELETE FROM refresh_tokens WHERE expires_at < $1`, before)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func rolesToJSON(roles []domain.Role) []byte {
	if len(roles) == 0 {
		return []byte("[]")
	}
	b, _ := json.Marshal(roles)
	return b
}
