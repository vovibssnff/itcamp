package domain

import "errors"

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserLocked         = errors.New("user is locked")
	ErrUserDisabled       = errors.New("user is disabled")
	ErrTooManyAttempts    = errors.New("too many failed attempts")
	ErrTokenRevoked       = errors.New("token is revoked")
	ErrTokenExpired       = errors.New("token is expired")
	ErrTokenInvalid       = errors.New("token is invalid")
	ErrMFARequired        = errors.New("mfa required")
	ErrMFAInvalid         = errors.New("invalid mfa code")
	ErrMFANotEnabled      = errors.New("mfa is not enabled")
	ErrUserNotFound       = errors.New("user not found")
	ErrRoleNotFound       = errors.New("role not found")
	ErrLoginTaken         = errors.New("login already taken")
	ErrPasswordPolicy     = errors.New("password does not meet policy")
	ErrLDAPUnavailable    = errors.New("ldap is unavailable")
	ErrForbidden          = errors.New("forbidden")
)
