package security

import (
	"strings"
	"testing"

	"github.com/itcamp/ktc/services/auth/internal/config"
	"github.com/itcamp/ktc/services/auth/internal/domain"
)

func testSecurityConfig() config.SecurityConfig {
	return config.SecurityConfig{
		PasswordMinLen:   8,
		LockoutThreshold: 5,
	}
}

func TestPasswordPolicy_Valid(t *testing.T) {
	p := NewPasswordPolicy(testSecurityConfig())
	cases := []string{
		"Password1",
		"Abcdef123",
		"Test1234",
		"XyZ789ab",
	}
	for _, pw := range cases {
		if err := p.Validate(pw); err != nil {
			t.Errorf("expected valid for %q, got %v", pw, err)
		}
	}
}

func TestPasswordPolicy_TooShort(t *testing.T) {
	p := NewPasswordPolicy(testSecurityConfig())
	err := p.Validate("Ab1")
	if err == nil {
		t.Fatal("expected error for short password")
	}
	if !strings.Contains(err.Error(), "минимум") {
		t.Errorf("expected length error, got %v", err)
	}
}

func TestPasswordPolicy_NoUppercase(t *testing.T) {
	p := NewPasswordPolicy(testSecurityConfig())
	err := p.Validate("password1")
	if err == nil {
		t.Fatal("expected error for no uppercase")
	}
	if !strings.Contains(err.Error(), "верхний") {
		t.Errorf("expected uppercase error, got %v", err)
	}
}

func TestPasswordPolicy_NoLowercase(t *testing.T) {
	p := NewPasswordPolicy(testSecurityConfig())
	err := p.Validate("PASSWORD1")
	if err == nil {
		t.Fatal("expected error for no lowercase")
	}
}

func TestPasswordPolicy_NoDigit(t *testing.T) {
	p := NewPasswordPolicy(testSecurityConfig())
	err := p.Validate("PasswordAB")
	if err == nil {
		t.Fatal("expected error for no digit")
	}
}

func TestPasswordPolicy_Empty(t *testing.T) {
	p := NewPasswordPolicy(testSecurityConfig())
	err := p.Validate("")
	if err == nil {
		t.Fatal("expected error for empty password")
	}
}

func TestPasswordPolicy_ExactMinLength(t *testing.T) {
	p := NewPasswordPolicy(testSecurityConfig())
	if err := p.Validate("Abcdefg1"); err != nil {
		t.Errorf("expected valid for 8 chars, got %v", err)
	}
}

func TestPasswordPolicy_CustomMinLength(t *testing.T) {
	cfg := testSecurityConfig()
	cfg.PasswordMinLen = 12
	p := NewPasswordPolicy(cfg)
	err := p.Validate("Abcdefg1")
	if err == nil {
		t.Fatal("expected error for <12 chars with custom min")
	}
	if err := p.Validate("Abcdefghijk1"); err != nil {
		t.Errorf("expected valid for 12 chars, got %v", err)
	}
}

func TestPasswordPolicy_Cyrillic(t *testing.T) {
	p := NewPasswordPolicy(testSecurityConfig())
	if err := p.Validate("Пароль123"); err != nil {
		t.Errorf("expected valid for cyrillic, got %v", err)
	}
}

func _() domain.Role { return domain.RoleAdmin }
