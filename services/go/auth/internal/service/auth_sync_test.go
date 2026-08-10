package service

import (
	"testing"

	"github.com/itcamp/ktc/services/auth/internal/domain"
	"github.com/itcamp/ktc/services/auth/internal/security"
)

func TestSyncUser_UpdatesRolesFromIdP(t *testing.T) {
	s := &AuthService{}
	user := domain.User{
		ID:       "u1",
		Login:    "instructor",
		FullName: "Old",
		Roles:    nil,
	}
	authUser := security.AuthenticatedUser{
		Login:    "instructor",
		FullName: "Инструктор",
		DN:       "cn=instructor",
		Roles:    []domain.Role{domain.RoleInstructor},
	}
	if !s.syncUser(&user, authUser) {
		t.Fatal("expected syncUser to report changes")
	}
	if user.FullName != "Инструктор" {
		t.Fatalf("FullName = %q", user.FullName)
	}
	if len(user.Roles) != 1 || user.Roles[0] != domain.RoleInstructor {
		t.Fatalf("Roles = %#v", user.Roles)
	}
	if !user.IsPrivileged() {
		t.Fatal("instructor must be privileged after sync")
	}
}

func TestRolesEqual(t *testing.T) {
	a := []domain.Role{domain.RoleAdmin, domain.RoleInstructor}
	b := []domain.Role{domain.RoleAdmin, domain.RoleInstructor}
	if !rolesEqual(a, b) {
		t.Fatal("expected equal")
	}
	if rolesEqual(a, []domain.Role{domain.RoleAdmin}) {
		t.Fatal("expected not equal")
	}
	if !rolesEqual(a, []domain.Role{domain.RoleInstructor, domain.RoleAdmin}) {
		t.Fatal("expected order-insensitive equal")
	}
}
