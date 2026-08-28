package service

import (
	"context"
	"errors"
	"testing"

	"github.com/itcamp/ktc/services/assessment/internal/domain"
)

func TestAuthorizeSessionAccess_PrivilegedBypass(t *testing.T) {
	t.Parallel()
	s := &AssessmentService{repo: newMockAssessmentStore()}
	if err := s.AuthorizeSessionAccess(context.Background(), "sess-1", "", true); err != nil {
		t.Fatalf("privileged must bypass: %v", err)
	}
}

func TestAuthorizeSessionAccess_DenyEmptyUser(t *testing.T) {
	t.Parallel()
	s := &AssessmentService{repo: newMockAssessmentStore()}
	err := s.AuthorizeSessionAccess(context.Background(), "sess-1", "", false)
	if !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden", err)
	}
}

func TestAuthorizeSessionAccess_MemberAllowed(t *testing.T) {
	t.Parallel()
	store := newMockAssessmentStore()
	store.members = map[string]map[string]bool{"sess-1": {"op-1": true}}
	s := &AssessmentService{repo: store}
	if err := s.AuthorizeSessionAccess(context.Background(), "sess-1", "op-1", false); err != nil {
		t.Fatalf("member must be allowed: %v", err)
	}
	err := s.AuthorizeSessionAccess(context.Background(), "sess-1", "op-2", false)
	if !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("non-member err = %v, want ErrForbidden", err)
	}
}
