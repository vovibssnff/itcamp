package service

import (
	"testing"

	"github.com/itcamp/ktc/services/auth/internal/config"
	"github.com/itcamp/ktc/services/auth/internal/domain"
)

func TestAuthService_requiresMFA(t *testing.T) {
	privileged := domain.User{Roles: []domain.Role{domain.RoleInstructor}}
	enrolled := domain.User{MFAEnabled: true, Roles: []domain.Role{domain.RoleOperator}}
	operator := domain.User{Roles: []domain.Role{domain.RoleOperator}}

	t.Run("enforced_by_default", func(t *testing.T) {
		s := &AuthService{cfg: config.SecurityConfig{}}
		if !s.requiresMFA(privileged) {
			t.Fatal("privileged user must require MFA when flag off")
		}
		if !s.requiresMFA(enrolled) {
			t.Fatal("MFA-enabled user must require MFA when flag off")
		}
		if s.requiresMFA(operator) {
			t.Fatal("non-privileged non-enrolled operator must not require MFA")
		}
	})

	t.Run("disabled_for_mvp", func(t *testing.T) {
		s := &AuthService{cfg: config.SecurityConfig{MFADisabled: true}}
		if s.requiresMFA(privileged) {
			t.Fatal("MFADisabled must skip privileged MFA")
		}
		if s.requiresMFA(enrolled) {
			t.Fatal("MFADisabled must skip enrolled MFA")
		}
		if s.requiresMFA(operator) {
			t.Fatal("MFADisabled must keep operator password-only")
		}
	})
}
