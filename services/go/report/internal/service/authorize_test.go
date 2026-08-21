package service

import (
	"context"
	"errors"
	"testing"

	"github.com/itcamp/ktc/services/report/internal/domain"
)

func TestAuthorizeSessionAccess_PrivilegedBypass(t *testing.T) {
	t.Parallel()
	s := &ReportService{}
	if err := s.AuthorizeSessionAccess(context.Background(), "sess-1", "", true); err != nil {
		t.Fatalf("privileged must bypass membership check: %v", err)
	}
}

func TestAuthorizeSessionAccess_DenyEmptyUser(t *testing.T) {
	t.Parallel()
	s := &ReportService{}
	err := s.AuthorizeSessionAccess(context.Background(), "sess-1", "", false)
	if !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden", err)
	}
}

func TestAuthorizeSessionAccess_DenyEmptySession(t *testing.T) {
	t.Parallel()
	s := &ReportService{}
	err := s.AuthorizeSessionAccess(context.Background(), "", "op-1", false)
	if !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden", err)
	}
}
