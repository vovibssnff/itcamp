package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/itcamp/ktc/services/auth/internal/service"
)

func TestAuth_MissingBearerRejected(t *testing.T) {
	intro := service.NewIntrospectService(nil)
	h := Auth(intro)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/users/u1/mfa", nil)
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestHasRole(t *testing.T) {
	roles := []string{"operator", "admin"}
	if !HasRole(roles, "admin") {
		t.Fatal("expected admin role")
	}
	if HasRole(roles, "instructor") {
		t.Fatal("did not expect instructor role")
	}
}
