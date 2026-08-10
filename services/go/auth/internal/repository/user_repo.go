package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/itcamp/ktc/services/auth/internal/domain"
)

type UserRepo struct {
	db *Postgres
}

func NewUserRepo(pg *Postgres) *UserRepo {
	return &UserRepo{db: pg}
}

const userCols = `id, login, full_name, ldap_dn, status, mfa_enabled, created_at, updated_at`

func (r *UserRepo) scanUser(row pgx.Row) (domain.User, error) {
	var u domain.User
	var status string
	if err := row.Scan(&u.ID, &u.Login, &u.FullName, &u.LDAPDN, &status, &u.MFAEnabled, &u.CreatedAt, &u.UpdatedAt); err != nil {
		return domain.User{}, err
	}
	u.Status = domain.UserStatus(status)
	return u, nil
}

func (r *UserRepo) GetByID(ctx context.Context, id string) (domain.User, error) {
	row := r.db.Pool.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE id = $1`, id)
	u, err := r.scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrUserNotFound
	}
	return u, err
}

func (r *UserRepo) GetByLogin(ctx context.Context, login string) (domain.User, error) {
	row := r.db.Pool.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE login = $1`, login)
	u, err := r.scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrUserNotFound
	}
	return u, err
}

func (r *UserRepo) GetByLDAPDN(ctx context.Context, dn string) (domain.User, error) {
	row := r.db.Pool.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE ldap_dn = $1`, dn)
	u, err := r.scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrUserNotFound
	}
	return u, err
}

func (r *UserRepo) List(ctx context.Context) ([]domain.User, error) {
	rows, err := r.db.Pool.Query(ctx, `SELECT `+userCols+` FROM users ORDER BY login`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []domain.User
	for rows.Next() {
		u, err := r.scanUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *UserRepo) Create(ctx context.Context, u domain.User) error {
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO users (id, login, full_name, ldap_dn, status, mfa_enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
		u.ID, u.Login, u.FullName, u.LDAPDN, string(u.Status), u.MFAEnabled)
	if isUniqueViolation(err) {
		return domain.ErrLoginTaken
	}
	return err
}

func (r *UserRepo) Update(ctx context.Context, u domain.User) error {
	tag, err := r.db.Pool.Exec(ctx, `
		UPDATE users SET full_name = $2, ldap_dn = $3, status = $4, mfa_enabled = $5, updated_at = now()
		WHERE id = $1`,
		u.ID, u.FullName, u.LDAPDN, string(u.Status), u.MFAEnabled)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrUserNotFound
	}
	return nil
}

func (r *UserRepo) UpdateStatus(ctx context.Context, id string, status domain.UserStatus) error {
	tag, err := r.db.Pool.Exec(ctx, `UPDATE users SET status = $2, updated_at = now() WHERE id = $1`, id, string(status))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrUserNotFound
	}
	return nil
}

func (r *UserRepo) SetMFAEnabled(ctx context.Context, id string, enabled bool) error {
	tag, err := r.db.Pool.Exec(ctx, `UPDATE users SET mfa_enabled = $2, updated_at = now() WHERE id = $1`, id, enabled)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrUserNotFound
	}
	return nil
}

func (r *UserRepo) GetRoles(ctx context.Context, userID string) ([]domain.Role, error) {
	rows, err := r.db.Pool.Query(ctx, `SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var roles []domain.Role
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		roles = append(roles, domain.Role(name))
	}
	return roles, rows.Err()
}

// SetRoles replaces user_roles for the user. role_id matches roles.id (= role name).
func (r *UserRepo) SetRoles(ctx context.Context, userID string, roles []domain.Role) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `DELETE FROM user_roles WHERE user_id = $1`, userID); err != nil {
		return err
	}
	for _, role := range roles {
		if !role.Valid() {
			continue
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
			ON CONFLICT DO NOTHING`, userID, string(role)); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}
