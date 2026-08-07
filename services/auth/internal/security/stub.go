package security

import (
	"context"
	"fmt"

	"github.com/itcamp/ktc/services/auth/internal/config"
	"github.com/itcamp/ktc/services/auth/internal/domain"
)

type StubAuthenticator struct {
	users map[string]config.StubUser
}

func NewStubAuthenticator(users []config.StubUser) (*StubAuthenticator, error) {
	if len(users) == 0 {
		return nil, fmt.Errorf("stub mode requires at least one [[auth.stub_users]] entry")
	}
	m := make(map[string]config.StubUser, len(users))
	for _, u := range users {
		if u.Login == "" {
			return nil, fmt.Errorf("stub user has empty login")
		}
		m[u.Login] = u
	}
	return &StubAuthenticator{users: m}, nil
}

func (s *StubAuthenticator) Authenticate(_ context.Context, login, password string) (AuthenticatedUser, error) {
	u, ok := s.users[login]
	if !ok || u.Password != password {
		return AuthenticatedUser{}, domain.ErrInvalidCredentials
	}

	roles := make([]domain.Role, 0, len(u.Roles))
	for _, r := range u.Roles {
		role := domain.Role(r)
		if !role.Valid() {
			continue
		}
		roles = append(roles, role)
	}

	return AuthenticatedUser{
		Login:    u.Login,
		FullName: u.FullName,
		DN:       fmt.Sprintf("cn=%s,ou=stub,dc=ktc,dc=local", u.Login),
		Roles:    roles,
	}, nil
}
