package handler

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/itcamp/ktc/services/report/internal/domain"
)

func reqWith(roles, userID string) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/reports", nil)
	if roles != "" {
		r.Header.Set("X-Roles", roles)
	}
	if userID != "" {
		r.Header.Set("X-User-ID", userID)
	}
	return r
}

func TestIsPrivileged(t *testing.T) {
	t.Parallel()
	if !isPrivileged(reqWith("admin", "u1")) {
		t.Fatal("admin should be privileged")
	}
	if !isPrivileged(reqWith("instructor,operator", "u1")) {
		t.Fatal("instructor should be privileged")
	}
	if isPrivileged(reqWith("operator", "u1")) {
		t.Fatal("operator must not be privileged")
	}
	if isPrivileged(reqWith("", "u1")) {
		t.Fatal("empty roles must not be privileged")
	}
}

func TestDecideSessionAccess(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name       string
		privileged bool
		userID     string
		member     bool
		wantErr    error
	}{
		{"admin_any", true, "", false, nil},
		{"instructor_any", true, "inst", false, nil},
		{"operator_member", false, "op-1", true, nil},
		{"operator_non_member", false, "op-2", false, domain.ErrForbidden},
		{"operator_no_uid", false, "", true, domain.ErrForbidden},
		{"no_roles_no_uid", false, "", false, domain.ErrForbidden},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			err := decideSessionAccess(tc.privileged, tc.userID, tc.member)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("err = %v, want %v", err, tc.wantErr)
			}
		})
	}
}

func TestMapErrorForbidden(t *testing.T) {
	t.Parallel()
	status, code := mapError(domain.ErrForbidden)
	if status != http.StatusForbidden || code != "forbidden" {
		t.Fatalf("got %d %q, want 403 forbidden", status, code)
	}
}
