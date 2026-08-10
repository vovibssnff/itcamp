package service

import (
	"testing"
	"time"

	"github.com/itcamp/ktc/services/auth/internal/config"
	"github.com/itcamp/ktc/services/auth/internal/domain"
)

func testTokenConfig() config.JWTConfig {
	return config.JWTConfig{
		SigningKey:    "test-signing-key-32-bytes-length-xxx",
		SigningMethod: "HS256",
		AccessTTL:     config.Duration(15 * time.Minute),
		RefreshTTL:    config.Duration(24 * time.Hour),
		Issuer:        "ktc-auth-test",
	}
}

func testUser() domain.User {
	return domain.User{
		ID:    "u-123",
		Login: "testuser",
		Roles: []domain.Role{domain.RoleInstructor},
	}
}

func TestTokenService_Introspect_Valid(t *testing.T) {
	ts := NewTokenService(testTokenConfig(), newMockRefreshStore(), nil)
	pair, err := ts.Issue(testCtx(), testUser())
	if err != nil {
		t.Fatalf("issue failed: %v", err)
	}

	result, err := ts.Introspect(testCtx(), pair.AccessToken)
	if err != nil {
		t.Fatalf("introspect failed: %v", err)
	}
	if !result.Active {
		t.Fatal("expected active token")
	}
	if result.Claims.UserID != "u-123" {
		t.Errorf("expected user_id u-123, got %s", result.Claims.UserID)
	}
	if result.Claims.Login != "testuser" {
		t.Errorf("expected login testuser, got %s", result.Claims.Login)
	}
	if len(result.Claims.Roles) != 1 || result.Claims.Roles[0] != domain.RoleInstructor {
		t.Errorf("expected role instructor, got %v", result.Claims.Roles)
	}
}

func TestTokenService_Introspect_Invalid(t *testing.T) {
	ts := NewTokenService(testTokenConfig(), newMockRefreshStore(), nil)
	result, err := ts.Introspect(testCtx(), "invalid.token.here")
	if err == nil {
		t.Fatal("expected error for invalid token")
	}
	if result.Active {
		t.Fatal("expected inactive for invalid token")
	}
}

func TestTokenService_Introspect_Empty(t *testing.T) {
	ts := NewTokenService(testTokenConfig(), newMockRefreshStore(), nil)
	result, err := ts.Introspect(testCtx(), "")
	if err == nil {
		t.Fatal("expected error for empty token")
	}
	if result.Active {
		t.Fatal("expected inactive for empty token")
	}
}

func TestTokenService_Introspect_WrongKey(t *testing.T) {
	ts := NewTokenService(testTokenConfig(), newMockRefreshStore(), nil)
	pair, _ := ts.Issue(testCtx(), testUser())

	ts2 := NewTokenService(config.JWTConfig{
		SigningKey:    "different-key-32-bytes-length-xxxxxx",
		SigningMethod: "HS256",
		AccessTTL:     config.Duration(15 * time.Minute),
		RefreshTTL:    config.Duration(24 * time.Hour),
		Issuer:        "ktc-auth-test",
	}, newMockRefreshStore(), nil)

	_, err := ts2.Introspect(testCtx(), pair.AccessToken)
	if err == nil {
		t.Fatal("expected error for token signed with different key")
	}
}

func TestTokenService_TokenPair_NotEmpty(t *testing.T) {
	ts := NewTokenService(testTokenConfig(), newMockRefreshStore(), nil)
	pair, err := ts.Issue(testCtx(), testUser())
	if err != nil {
		t.Fatalf("issue failed: %v", err)
	}
	if pair.AccessToken == "" {
		t.Error("access token should not be empty")
	}
	if pair.RefreshToken == "" {
		t.Error("refresh token should not be empty")
	}
	if pair.AccessToken == pair.RefreshToken {
		t.Error("access and refresh tokens should differ")
	}
	if pair.AccessTTL != 15*time.Minute {
		t.Errorf("expected access TTL 15m, got %v", pair.AccessTTL)
	}
	if pair.RefreshTTL != 24*time.Hour {
		t.Errorf("expected refresh TTL 24h, got %v", pair.RefreshTTL)
	}
}

func TestTokenService_Refresh_Rotation(t *testing.T) {
	store := newMockRefreshStore()
	ts := NewTokenService(testTokenConfig(), store, nil)

	pair, err := ts.Issue(testCtx(), testUser())
	if err != nil {
		t.Fatalf("issue failed: %v", err)
	}

	newPair, err := ts.Refresh(testCtx(), pair.RefreshToken)
	if err != nil {
		t.Fatalf("refresh failed: %v", err)
	}
	if newPair.AccessToken == "" {
		t.Error("new access token should not be empty")
	}
	if newPair.RefreshToken == pair.RefreshToken {
		t.Error("refresh token should be rotated")
	}

	_, err = ts.Refresh(testCtx(), pair.RefreshToken)
	if err == nil {
		t.Fatal("expected error when reusing old refresh token")
	}
}

func TestTokenService_Revoke(t *testing.T) {
	store := newMockRefreshStore()
	ts := NewTokenService(testTokenConfig(), store, nil)

	pair, err := ts.Issue(testCtx(), testUser())
	if err != nil {
		t.Fatalf("issue failed: %v", err)
	}

	if err := ts.Revoke(testCtx(), pair.RefreshToken); err != nil {
		t.Fatalf("revoke failed: %v", err)
	}

	_, err = ts.Refresh(testCtx(), pair.RefreshToken)
	if err == nil {
		t.Fatal("expected error after revoke")
	}
}
