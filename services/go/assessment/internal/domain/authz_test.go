package domain

import "testing"

func TestCanOverrideScore(t *testing.T) {
	tests := []struct {
		name  string
		roles []string
		want  bool
	}{
		{name: "instructor can override", roles: []string{"instructor"}, want: true},
		{name: "admin can override", roles: []string{"admin"}, want: true},
		{name: "operator cannot override", roles: []string{"operator"}, want: false},
		{name: "empty cannot override", roles: nil, want: false},
		{name: "mixed contains instructor", roles: []string{"operator", "instructor"}, want: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CanOverrideScore(tt.roles); got != tt.want {
				t.Errorf("CanOverrideScore(%v) = %v, want %v", tt.roles, got, tt.want)
			}
		})
	}
}
