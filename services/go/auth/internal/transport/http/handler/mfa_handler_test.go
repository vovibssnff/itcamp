package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/itcamp/ktc/services/auth/internal/domain"
	"github.com/itcamp/ktc/services/auth/internal/transport/http/middleware"
)

func TestAuthorizeMFATarget_SelfAllowed(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/users/u1/mfa/setup", nil)
	ctx := context.WithValue(r.Context(), middleware.CtxUserID, "u1")
	ctx = context.WithValue(ctx, middleware.CtxRoles, []string{string(domain.RoleOperator)})
	r = r.WithContext(ctx)

	if err := authorizeMFATarget(r, "u1"); err != nil {
		t.Fatalf("self MFA manage should be allowed, got %v", err)
	}
}

func TestAuthorizeMFATarget_AdminAllowedForOtherUser(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/users/u2/mfa/setup", nil)
	ctx := context.WithValue(r.Context(), middleware.CtxUserID, "admin-1")
	ctx = context.WithValue(ctx, middleware.CtxRoles, []string{string(domain.RoleAdmin)})
	r = r.WithContext(ctx)

	if err := authorizeMFATarget(r, "u2"); err != nil {
		t.Fatalf("admin MFA manage for other user should be allowed, got %v", err)
	}
}

func TestAuthorizeMFATarget_OtherUserForbidden(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/users/u2/mfa/setup", nil)
	ctx := context.WithValue(r.Context(), middleware.CtxUserID, "u1")
	ctx = context.WithValue(ctx, middleware.CtxRoles, []string{string(domain.RoleOperator)})
	r = r.WithContext(ctx)

	if err := authorizeMFATarget(r, "u2"); err != domain.ErrForbidden {
		t.Fatalf("got %v, want ErrForbidden", err)
	}
}

func TestAuthorizeMFATarget_MissingCaller(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/users/u1/mfa/setup", nil)
	if err := authorizeMFATarget(r, "u1"); err != domain.ErrTokenInvalid {
		t.Fatalf("got %v, want ErrTokenInvalid", err)
	}
}
