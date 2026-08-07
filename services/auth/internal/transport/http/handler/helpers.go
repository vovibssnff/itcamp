package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/itcamp/ktc/services/auth/internal/domain"
	"github.com/itcamp/ktc/services/auth/internal/transport/http/dto"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, err error) {
	status, code := mapError(err)
	writeJSON(w, status, dto.ErrorResponse{Error: err.Error(), Code: code})
}

func mapError(err error) (int, string) {
	switch {
	case errors.Is(err, domain.ErrInvalidCredentials):
		return http.StatusUnauthorized, "invalid_credentials"
	case errors.Is(err, domain.ErrUserLocked), errors.Is(err, domain.ErrTooManyAttempts):
		return http.StatusTooManyRequests, "locked"
	case errors.Is(err, domain.ErrUserDisabled):
		return http.StatusForbidden, "disabled"
	case errors.Is(err, domain.ErrUserNotFound):
		return http.StatusNotFound, "user_not_found"
	case errors.Is(err, domain.ErrTokenExpired):
		return http.StatusUnauthorized, "token_expired"
	case errors.Is(err, domain.ErrTokenRevoked), errors.Is(err, domain.ErrTokenInvalid):
		return http.StatusUnauthorized, "token_invalid"
	case errors.Is(err, domain.ErrMFARequired):
		return http.StatusUnauthorized, "mfa_required"
	case errors.Is(err, domain.ErrMFAInvalid):
		return http.StatusUnauthorized, "mfa_invalid"
	case errors.Is(err, domain.ErrMFANotEnabled):
		return http.StatusBadRequest, "mfa_not_enabled"
	case errors.Is(err, domain.ErrRoleNotFound):
		return http.StatusBadRequest, "role_not_found"
	case errors.Is(err, domain.ErrLoginTaken):
		return http.StatusConflict, "login_taken"
	case errors.Is(err, domain.ErrPasswordPolicy):
		return http.StatusBadRequest, "password_policy"
	case errors.Is(err, domain.ErrLDAPUnavailable):
		return http.StatusServiceUnavailable, "ldap_unavailable"
	default:
		return http.StatusInternalServerError, "internal"
	}
}

func clientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return ip
	}
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	return r.RemoteAddr
}

func rolesToStrings(roles []domain.Role) []string {
	out := make([]string, 0, len(roles))
	for _, r := range roles {
		out = append(out, string(r))
	}
	return out
}

func stringsToRoles(ss []string) []domain.Role {
	roles := make([]domain.Role, 0, len(ss))
	for _, s := range ss {
		r := domain.Role(s)
		if r.Valid() {
			roles = append(roles, r)
		}
	}
	return roles
}

func userToResponse(u domain.User) dto.UserResponse {
	return dto.UserResponse{
		ID: u.ID, Login: u.Login, FullName: u.FullName, LDAPDN: u.LDAPDN,
		Roles: rolesToStrings(u.Roles), Status: string(u.Status), MFAEnabled: u.MFAEnabled,
	}
}
