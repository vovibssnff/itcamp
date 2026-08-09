package domain

import "testing"

func TestRole_Valid(t *testing.T) {
	tests := []struct {
		name string
		role Role
		want bool
	}{
		{"admin", RoleAdmin, true},
		{"instructor", RoleInstructor, true},
		{"operator", RoleOperator, true},
		{"empty", Role(""), false},
		{"unknown", Role("superuser"), false},
		{"uppercase", Role("ADMIN"), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.role.Valid(); got != tt.want {
				t.Errorf("Valid(%q) = %v, want %v", tt.role, got, tt.want)
			}
		})
	}
}

func TestRole_IsPrivileged(t *testing.T) {
	tests := []struct {
		name string
		role Role
		want bool
	}{
		{"admin", RoleAdmin, true},
		{"instructor", RoleInstructor, true},
		{"operator", RoleOperator, false},
		{"unknown", Role("guest"), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.role.IsPrivileged(); got != tt.want {
				t.Errorf("IsPrivileged(%q) = %v, want %v", tt.role, got, tt.want)
			}
		})
	}
}

func TestAllRoles(t *testing.T) {
	got := AllRoles()
	want := []Role{RoleAdmin, RoleInstructor, RoleOperator}
	if len(got) != len(want) {
		t.Fatalf("AllRoles() length = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("AllRoles()[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}
