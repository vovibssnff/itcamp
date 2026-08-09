package security

import (
	"context"
	"errors"
	"testing"

	"github.com/itcamp/ktc/services/auth/internal/config"
	"github.com/itcamp/ktc/services/auth/internal/domain"
)

func stubUsers() []config.StubUser {
	return []config.StubUser{
		{Login: "admin", Password: "secret", FullName: "Admin User", Roles: []string{"admin", "operator"}},
		{Login: "op", Password: "op123", FullName: "Operator", Roles: []string{"operator"}},
	}
}

func TestNewStubAuthenticator_Empty(t *testing.T) {
	if _, err := NewStubAuthenticator(nil); err == nil {
		t.Error("expected error for empty stub users")
	}
}

func TestNewStubAuthenticator_EmptyLogin(t *testing.T) {
	_, err := NewStubAuthenticator([]config.StubUser{{Password: "x", Roles: []string{"admin"}}})
	if err == nil {
		t.Error("expected error for stub user with empty login")
	}
}

func TestStubAuthenticator_Authenticate_Valid(t *testing.T) {
	s, err := NewStubAuthenticator(stubUsers())
	if err != nil {
		t.Fatalf("NewStubAuthenticator: %v", err)
	}
	u, err := s.Authenticate(context.Background(), "admin", "secret")
	if err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	if u.Login != "admin" {
		t.Errorf("Login = %q, want admin", u.Login)
	}
	if u.FullName != "Admin User" {
		t.Errorf("FullName = %q, want Admin User", u.FullName)
	}
	if u.DN == "" {
		t.Error("DN should not be empty")
	}
	wantRoles := []domain.Role{domain.RoleAdmin, domain.RoleOperator}
	if len(u.Roles) != len(wantRoles) {
		t.Fatalf("roles = %v, want %v", u.Roles, wantRoles)
	}
	for i := range wantRoles {
		if u.Roles[i] != wantRoles[i] {
			t.Errorf("roles[%d] = %q, want %q", i, u.Roles[i], wantRoles[i])
		}
	}
}

func TestStubAuthenticator_InvalidPassword(t *testing.T) {
	s, _ := NewStubAuthenticator(stubUsers())
	_, err := s.Authenticate(context.Background(), "admin", "wrong")
	if !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Errorf("err = %v, want ErrInvalidCredentials", err)
	}
}

func TestStubAuthenticator_UnknownUser(t *testing.T) {
	s, _ := NewStubAuthenticator(stubUsers())
	_, err := s.Authenticate(context.Background(), "nobody", "secret")
	if !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Errorf("err = %v, want ErrInvalidCredentials", err)
	}
}

func TestStubAuthenticator_SkipsInvalidRoles(t *testing.T) {
	s, err := NewStubAuthenticator([]config.StubUser{
		{Login: "bad", Password: "p", Roles: []string{"admin", "not_a_role"}},
	})
	if err != nil {
		t.Fatalf("NewStubAuthenticator: %v", err)
	}
	u, err := s.Authenticate(context.Background(), "bad", "p")
	if err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	if len(u.Roles) != 1 || u.Roles[0] != domain.RoleAdmin {
		t.Errorf("roles = %v, want [admin]", u.Roles)
	}
}
