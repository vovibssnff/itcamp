package security

import (
	"fmt"
	"unicode"

	"github.com/itcamp/ktc/services/auth/internal/config"
	"github.com/itcamp/ktc/services/auth/internal/domain"
)

type PasswordPolicy struct {
	minLen int
}

func NewPasswordPolicy(cfg config.SecurityConfig) *PasswordPolicy {
	return &PasswordPolicy{minLen: cfg.PasswordMinLen}
}

func (p *PasswordPolicy) Validate(password string) error {
	if len(password) < p.minLen {
		return fmt.Errorf("%w: минимум %d символов", domain.ErrPasswordPolicy, p.minLen)
	}
	var hasUpper, hasLower, hasDigit bool
	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		}
	}
	if !hasUpper || !hasLower || !hasDigit {
		return fmt.Errorf("%w: нужен верхний регистр, нижний регистр и цифра", domain.ErrPasswordPolicy)
	}
	return nil
}
