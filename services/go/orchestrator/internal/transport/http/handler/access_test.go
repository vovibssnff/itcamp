package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

func reqWith(roles, userID string) *http.Request {
	r := httptest.NewRequest(http.MethodPost, "/sessions", nil)
	if roles != "" {
		r.Header.Set("X-Roles", roles)
	}
	if userID != "" {
		r.Header.Set("X-User-ID", userID)
	}
	return r
}

func TestCanCreateSession_Privileged(t *testing.T) {
	t.Parallel()
	for _, roles := range []string{"instructor", "admin", "instructor,operator"} {
		if !canCreateSession(reqWith(roles, "u1"), "exam", []string{"op-other"}) {
			t.Fatalf("expected privileged role %q to create any session", roles)
		}
	}
}

func TestCanCreateSession_OperatorSelfTraining(t *testing.T) {
	t.Parallel()
	r := reqWith("operator", "op-1")
	if !canCreateSession(r, "training", []string{"op-1"}) {
		t.Fatal("operator should create own training session")
	}
	if !canCreateSession(r, "", []string{"op-1"}) {
		t.Fatal("empty mode should default to training for self-create check")
	}
}

func TestCanCreateSession_OperatorDenied(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		mode string
		ops  []string
		uid  string
	}{
		{"exam", "exam", []string{"op-1"}, "op-1"},
		{"demo", "demo", []string{"op-1"}, "op-1"},
		{"other_operator", "training", []string{"op-2"}, "op-1"},
		{"multiple_ops", "training", []string{"op-1", "op-2"}, "op-1"},
		{"no_ops", "training", nil, "op-1"},
		{"no_uid", "training", []string{"op-1"}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			r := reqWith("operator", tc.uid)
			if canCreateSession(r, tc.mode, tc.ops) {
				t.Fatalf("expected deny for %+v", tc)
			}
		})
	}
}

func TestCanAccessSession_OperatorOnRoster(t *testing.T) {
	t.Parallel()
	sess := domain.Session{OperatorIDs: []string{"op-1"}, InstructorID: "inst-1"}
	if !canAccessSession(reqWith("operator", "op-1"), sess) {
		t.Fatal("operator on roster should access")
	}
	if canAccessSession(reqWith("operator", "op-2"), sess) {
		t.Fatal("unrelated operator must not access")
	}
}
