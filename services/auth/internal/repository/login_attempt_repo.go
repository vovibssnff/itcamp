package repository

import (
	"context"
	"time"

	"github.com/itcamp/ktc/services/auth/internal/domain"
)

type LoginAttempt struct {
	Login   string
	Success bool
	IPAddr  string
	UserID  string
	At      time.Time
}

type LoginAttemptRepo struct {
	db *Postgres
}

func NewLoginAttemptRepo(pg *Postgres) *LoginAttemptRepo {
	return &LoginAttemptRepo{db: pg}
}

func (r *LoginAttemptRepo) Record(ctx context.Context, a LoginAttempt) error {
	var userID any
	if a.UserID != "" {
		userID = a.UserID
	}
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO login_attempts (user_id, login, success, ip_addr, attempted_at)
		VALUES ($1, $2, $3, $4, $5)`,
		userID, a.Login, a.Success, a.IPAddr, a.At)
	return err
}

func (r *LoginAttemptRepo) CountFailed(ctx context.Context, login string, since time.Time) (int, error) {
	var count int
	err := r.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM login_attempts
		WHERE login = $1 AND success = FALSE AND attempted_at >= $2`,
		login, since).Scan(&count)
	return count, err
}

func (r *LoginAttemptRepo) IsLocked(ctx context.Context, userID string) (bool, error) {
	u, err := NewUserRepo(r.db).GetByID(ctx, userID)
	if err != nil {
		return false, err
	}
	return u.Status == domain.UserStatusLocked, nil
}

func (r *LoginAttemptRepo) CleanupOlderThan(ctx context.Context, before time.Time) (int64, error) {
	tag, err := r.db.Pool.Exec(ctx, `DELETE FROM login_attempts WHERE attempted_at < $1`, before)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
