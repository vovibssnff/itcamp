package domain

import "testing"

func TestCanEditTemplate(t *testing.T) {
	tests := []struct {
		name  string
		roles []string
		want  bool
	}{
		{name: "instructor can edit", roles: []string{"instructor"}, want: true},
		{name: "admin cannot edit", roles: []string{"admin"}, want: false},
		{name: "operator cannot edit", roles: []string{"operator"}, want: false},
		{name: "empty cannot edit", roles: nil, want: false},
		{name: "mixed contains instructor", roles: []string{"operator", "instructor"}, want: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CanEditTemplate(tt.roles); got != tt.want {
				t.Errorf("CanEditTemplate(%v) = %v, want %v", tt.roles, got, tt.want)
			}
		})
	}
}

func TestCanDeleteTemplate(t *testing.T) {
	tests := []struct {
		name  string
		roles []string
		force bool
		want  bool
	}{
		{name: "instructor soft delete", roles: []string{"instructor"}, force: false, want: true},
		{name: "instructor cannot hard delete", roles: []string{"instructor"}, force: true, want: false},
		{name: "admin cannot soft delete", roles: []string{"admin"}, force: false, want: false},
		{name: "admin hard delete", roles: []string{"admin"}, force: true, want: true},
		{name: "operator cannot delete", roles: []string{"operator"}, force: false, want: false},
		{name: "operator cannot hard delete", roles: []string{"operator"}, force: true, want: false},
		{name: "empty cannot delete", roles: nil, force: true, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CanDeleteTemplate(tt.roles, tt.force); got != tt.want {
				t.Errorf("CanDeleteTemplate(%v, %v) = %v, want %v", tt.roles, tt.force, got, tt.want)
			}
		})
	}
}

func TestCanManageComponent(t *testing.T) {
	tests := []struct {
		name  string
		roles []string
		want  bool
	}{
		{name: "instructor can manage", roles: []string{"instructor"}, want: true},
		{name: "admin can manage", roles: []string{"admin"}, want: true},
		{name: "operator cannot manage", roles: []string{"operator"}, want: false},
		{name: "empty cannot manage", roles: nil, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CanManageComponent(tt.roles); got != tt.want {
				t.Errorf("CanManageComponent(%v) = %v, want %v", tt.roles, got, tt.want)
			}
		})
	}
}

func TestCanDeleteComponent(t *testing.T) {
	tests := []struct {
		name  string
		roles []string
		want  bool
	}{
		{name: "admin can delete", roles: []string{"admin"}, want: true},
		{name: "instructor cannot delete", roles: []string{"instructor"}, want: false},
		{name: "operator cannot delete", roles: []string{"operator"}, want: false},
		{name: "empty cannot delete", roles: nil, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CanDeleteComponent(tt.roles); got != tt.want {
				t.Errorf("CanDeleteComponent(%v) = %v, want %v", tt.roles, got, tt.want)
			}
		})
	}
}
