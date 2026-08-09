package security

import (
	"testing"

	"github.com/itcamp/ktc/services/auth/internal/config"
	"github.com/itcamp/ktc/services/auth/internal/domain"
)

func TestLDAPClient_MapRoles(t *testing.T) {
	cfg := config.LDAPConfig{
		AdminGroup:      "CN=KTC-ADMINS",
		InstructorGroup: "CN=KTC-INSTRUCTORS",
		OperatorGroup:   "CN=KTC-OPERATORS",
	}
	c := NewLDAPClient(cfg)

	tests := []struct {
		name   string
		groups []string
		want   []domain.Role
	}{
		{"admin", []string{"cn=ktc-admins,ou=groups,dc=ktc"}, []domain.Role{domain.RoleAdmin}},
		{"instructor", []string{"cn=ktc-instructors,ou=groups,dc=ktc"}, []domain.Role{domain.RoleInstructor}},
		{"operator", []string{"cn=ktc-operators,ou=groups,dc=ktc"}, []domain.Role{domain.RoleOperator}},
		{"none", []string{"cn=developers,ou=groups,dc=ktc"}, nil},
		{"empty", nil, nil},
		{"case insensitive", []string{"CN=KTC-ADMINS,OU=GROUPS,DC=KTC"}, []domain.Role{domain.RoleAdmin}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := c.MapRoles(tt.groups)
			if len(got) != len(tt.want) {
				t.Fatalf("MapRoles(%v) = %v, want %v", tt.groups, got, tt.want)
			}
			for i := range tt.want {
				if got[i] != tt.want[i] {
					t.Errorf("MapRoles(%v)[%d] = %q, want %q", tt.groups, i, got[i], tt.want[i])
				}
			}
		})
	}
}

func TestLDAPClient_MapRoles_NoDups(t *testing.T) {
	cfg := config.LDAPConfig{AdminGroup: "CN=KTC-ADMINS"}
	c := NewLDAPClient(cfg)
	groups := []string{
		"cn=ktc-admins,ou=groups,dc=ktc",
		"CN=KTC-ADMINS,OU=GROUPS,DC=KTC",
	}
	got := c.MapRoles(groups)
	if len(got) != 1 {
		t.Errorf("MapRoles duplicates admin role: got %v", got)
	}
}

func TestLDAPClient_MapRoles_Priority(t *testing.T) {
	cfg := config.LDAPConfig{
		AdminGroup:      "CN=KTC-ADMINS",
		InstructorGroup: "CN=KTC-INSTRUCTORS",
	}
	c := NewLDAPClient(cfg)
	// both admin and instructor groups present -> admin wins (first case match)
	groups := []string{"cn=ktc-instructors,ou=groups,dc=ktc", "cn=ktc-admins,ou=groups,dc=ktc"}
	got := c.MapRoles(groups)
	if len(got) != 2 {
		t.Fatalf("expected two roles, got %v", got)
	}
	if got[0] != domain.RoleInstructor || got[1] != domain.RoleAdmin {
		t.Errorf("unexpected order/roles: %v", got)
	}
}
