package domain

import "testing"

func TestCanManageScenario(t *testing.T) {
	cases := []struct {
		roles []string
		want  bool
	}{
		{nil, false},
		{[]string{RoleOperator}, false},
		{[]string{RoleInstructor}, true},
		{[]string{RoleAdmin}, true},
		{[]string{RoleOperator, RoleInstructor}, true},
	}
	for _, tt := range cases {
		if got := CanManageScenario(tt.roles); got != tt.want {
			t.Errorf("CanManageScenario(%v)=%v want %v", tt.roles, got, tt.want)
		}
	}
}

func TestMustRedactAnswerKey(t *testing.T) {
	cases := []struct {
		name  string
		roles []string
		want  bool
	}{
		{"empty roles (service call)", nil, false},
		{"operator", []string{RoleOperator}, true},
		{"instructor", []string{RoleInstructor}, false},
		{"admin", []string{RoleAdmin}, false},
		{"operator+instructor", []string{RoleOperator, RoleInstructor}, false},
	}
	for _, tt := range cases {
		if got := MustRedactAnswerKey(tt.roles); got != tt.want {
			t.Errorf("%s: MustRedactAnswerKey(%v)=%v want %v", tt.name, tt.roles, got, tt.want)
		}
	}
}

func TestRedactAnswerKey(t *testing.T) {
	s := Scenario{
		ID:   "s1",
		Name: "exam",
		Faults: []ScenarioFault{{
			ID: "f1", FaultID: "FLT-X",
		}},
		ReferenceActions: []ReferenceAction{{
			Step: 1, Description: "open valve",
		}},
		Criteria: Criteria{MaxScore: 100, PassThreshold: 70},
	}
	out := RedactAnswerKey(s)
	if out.Name != "exam" || out.ID != "s1" {
		t.Fatalf("identity fields should remain: %+v", out)
	}
	if out.ReferenceActions != nil || out.Faults != nil || out.Criteria.MaxScore != 0 {
		t.Fatalf("answer key not redacted: %+v", out)
	}
}
