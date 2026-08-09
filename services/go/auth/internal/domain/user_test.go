package domain

import "testing"

func TestUser_HasRole(t *testing.T) {
	u := User{Roles: []Role{RoleAdmin, RoleOperator}}
	if !u.HasRole(RoleAdmin) {
		t.Error("HasRole(admin) = false, want true")
	}
	if !u.HasRole(RoleOperator) {
		t.Error("HasRole(operator) = false, want true")
	}
	if u.HasRole(RoleInstructor) {
		t.Error("HasRole(instructor) = true, want false")
	}
}

func TestUser_HasRole_NoRoles(t *testing.T) {
	u := User{}
	if u.HasRole(RoleAdmin) {
		t.Error("HasRole(admin) = true on empty roles, want false")
	}
}

func TestUser_IsPrivileged(t *testing.T) {
	tests := []struct {
		name  string
		roles []Role
		want  bool
	}{
		{"admin", []Role{RoleAdmin}, true},
		{"instructor", []Role{RoleInstructor}, true},
		{"operator", []Role{RoleOperator}, false},
		{"operator+admin", []Role{RoleOperator, RoleAdmin}, true},
		{"empty", nil, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u := User{Roles: tt.roles}
			if got := u.IsPrivileged(); got != tt.want {
				t.Errorf("IsPrivileged(%v) = %v, want %v", tt.roles, got, tt.want)
			}
		})
	}
}
