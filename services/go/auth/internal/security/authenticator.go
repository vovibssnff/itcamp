package security

import (
	"context"

	"github.com/itcamp/ktc/services/auth/internal/domain"
)

type AuthenticatedUser struct {
	Login    string
	FullName string
	DN       string
	Roles    []domain.Role
}

type Authenticator interface {
	Authenticate(ctx context.Context, login, password string) (AuthenticatedUser, error)
}
