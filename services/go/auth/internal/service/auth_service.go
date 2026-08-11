package service

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/itcamp/ktc/services/auth/internal/config"
	"github.com/itcamp/ktc/services/auth/internal/domain"
	"github.com/itcamp/ktc/services/auth/internal/repository"
	"github.com/itcamp/ktc/services/auth/internal/security"
)

type AuthService struct {
	cfg           config.SecurityConfig
	userRepo      *repository.UserRepo
	authenticator security.Authenticator
	token         *TokenService
	mfa           *MFAService
	attempts      *repository.LoginAttemptRepo
	audit         *AuditService
	log           *slog.Logger
}

func NewAuthService(
	cfg config.SecurityConfig,
	userRepo *repository.UserRepo,
	authenticator security.Authenticator,
	token *TokenService,
	mfa *MFAService,
	attempts *repository.LoginAttemptRepo,
	audit *AuditService,
	log *slog.Logger,
) *AuthService {
	return &AuthService{
		cfg: cfg, userRepo: userRepo, authenticator: authenticator, token: token, mfa: mfa,
		attempts: attempts, audit: audit, log: log,
	}
}

type LoginInput struct {
	Login    string
	Password string
	MFACode  string
	IP       string
}

type LoginResult struct {
	Tokens    domain.TokenPair
	MFANeeded bool
	User      domain.User
	// EnrollmentToken is a short-lived token to fetch MFA QR/secret when the
	// user is not yet enrolled. Empty when MFA is already enabled.
	EnrollmentToken string
}

func (s *AuthService) Login(ctx context.Context, in LoginInput) (LoginResult, error) {
	if locked, err := s.isLocked(ctx, in.Login); err != nil {
		return LoginResult{}, err
	} else if locked {
		return LoginResult{}, domain.ErrTooManyAttempts
	}

	authUser, err := s.authenticator.Authenticate(ctx, in.Login, in.Password)
	if err != nil {
		s.recordFailedAttempt(ctx, in.Login, in.IP, "")
		if errors.Is(err, domain.ErrInvalidCredentials) {
			IncAuthLogin("fail")
			return LoginResult{}, domain.ErrInvalidCredentials
		}
		IncAuthLogin("fail")
		return LoginResult{}, err
	}

	user, err := s.userRepo.GetByLDAPDN(ctx, authUser.DN)
	if errors.Is(err, domain.ErrUserNotFound) {
		user = s.buildUser(authUser)
		if err := s.userRepo.Create(ctx, user); err != nil {
			if !errors.Is(err, domain.ErrLoginTaken) {
				return LoginResult{}, err
			}
			// Parallel first login: load the winner and continue.
			existing, getErr := s.userRepo.GetByLogin(ctx, authUser.Login)
			if getErr != nil {
				return LoginResult{}, getErr
			}
			user = existing
			_ = s.syncUser(&user, authUser)
			_ = s.userRepo.Update(ctx, user)
		} else {
			IncAuthUserCreated()
		}
	} else if err != nil {
		return LoginResult{}, err
	} else {
		if changed := s.syncUser(&user, authUser); changed {
			_ = s.userRepo.Update(ctx, user)
		}
	}

	// Sync IdP/stub roles only when the authenticator returned a non-empty set.
	// Empty IdP groups must not wipe DB roles.
	if len(authUser.Roles) > 0 {
		user.Roles = authUser.Roles
		if err := s.userRepo.SetRoles(ctx, user.ID, user.Roles); err != nil {
			return LoginResult{}, err
		}
	} else {
		roles, err := s.userRepo.GetRoles(ctx, user.ID)
		if err != nil {
			return LoginResult{}, err
		}
		user.Roles = roles
	}

	if user.Status == domain.UserStatusDisabled {
		return LoginResult{}, domain.ErrUserDisabled
	}
	if user.Status == domain.UserStatusLocked {
		return LoginResult{}, domain.ErrUserLocked
	}

	// MVP: security.mfa_disabled / AUTH_MFA_DISABLED skips TOTP entirely (password-only login).
	// Remove or set false to restore privileged/enrolled MFA enforcement.
	if s.requiresMFA(user) {
		if in.MFACode == "" {
			result := LoginResult{MFANeeded: true, User: user}
			if !user.MFAEnabled {
				// Ensure secret exists server-side; client fetches it with enrollment token.
				// Empty secret means MFA secret row is already enabled — only ask for code.
				secret, err := s.mfa.EnsureEnrollmentSecret(ctx, user.ID)
				if err != nil {
					return LoginResult{}, err
				}
				if secret != "" {
					tok, err := s.token.IssueEnrollment(user.ID, user.Login)
					if err != nil {
						return LoginResult{}, err
					}
					result.EnrollmentToken = tok
				}
			}
			s.audit.Log(ctx, AuditLoginMFARequired, user.ID, in.IP)
			return result, domain.ErrMFARequired
		}
		if err := s.mfa.Verify(ctx, user.ID, in.MFACode); err != nil {
			s.recordFailedAttempt(ctx, in.Login, in.IP, user.ID)
			IncAuthLogin("fail")
			return LoginResult{}, err
		}
		// First successful code after enrollment marks MFA as enabled on the user row.
		if !user.MFAEnabled {
			if err := s.mfa.Enable(ctx, user.ID, in.MFACode); err != nil {
				return LoginResult{}, err
			}
		}
	}

	tokens, err := s.token.Issue(ctx, user)
	if err != nil {
		return LoginResult{}, err
	}

	s.recordSuccessfulAttempt(ctx, in.Login, in.IP, user.ID)
	s.audit.Log(ctx, AuditLoginSuccess, user.ID, in.IP)
	IncAuthLogin("success")
	return LoginResult{Tokens: tokens, User: user}, nil
}

// requiresMFA reports whether login must collect/verify a TOTP code.
// When MFADisabled is set (MVP), privileged and already-enrolled users skip MFA.
func (s *AuthService) requiresMFA(user domain.User) bool {
	if s.cfg.MFADisabled {
		return false
	}
	return user.MFAEnabled || user.IsPrivileged()
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	return s.token.Revoke(ctx, refreshToken)
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (domain.TokenPair, error) {
	tokens, err := s.token.Refresh(ctx, refreshToken)
	if err != nil {
		IncAuthRefresh("fail")
		return domain.TokenPair{}, err
	}
	IncAuthRefresh("success")
	return tokens, nil
}

func (s *AuthService) isLocked(ctx context.Context, login string) (bool, error) {
	since := time.Now().UTC().Add(-s.cfg.LockoutWindow.Std())
	count, err := s.attempts.CountFailed(ctx, login, since)
	if err != nil {
		return false, err
	}
	return count >= s.cfg.LockoutThreshold, nil
}

func (s *AuthService) recordFailedAttempt(ctx context.Context, login, ip, userID string) {
	_ = s.attempts.Record(ctx, repository.LoginAttempt{
		Login: login, Success: false, IPAddr: ip, UserID: userID, At: time.Now().UTC(),
	})
	if userID != "" {
		since := time.Now().UTC().Add(-s.cfg.LockoutWindow.Std())
		count, err := s.attempts.CountFailed(ctx, login, since)
		if err == nil && count >= s.cfg.LockoutThreshold {
			_ = s.userRepo.UpdateStatus(ctx, userID, domain.UserStatusLocked)
			s.audit.Log(ctx, AuditUserLocked, userID, ip)
		}
	}
}

func (s *AuthService) recordSuccessfulAttempt(ctx context.Context, login, ip, userID string) {
	_ = s.attempts.Record(ctx, repository.LoginAttempt{
		Login: login, Success: true, IPAddr: ip, UserID: userID, At: time.Now().UTC(),
	})
}

func (s *AuthService) buildUser(authUser security.AuthenticatedUser) domain.User {
	return domain.User{
		ID:       newUUID(),
		Login:    authUser.Login,
		FullName: authUser.FullName,
		LDAPDN:   authUser.DN,
		Roles:    authUser.Roles,
		Status:   domain.UserStatusActive,
	}
}

func (s *AuthService) syncUser(user *domain.User, authUser security.AuthenticatedUser) bool {
	changed := false
	if user.FullName != authUser.FullName {
		user.FullName = authUser.FullName
		changed = true
	}
	if !rolesEqual(user.Roles, authUser.Roles) {
		user.Roles = authUser.Roles
		changed = true
	}
	return changed
}

func rolesEqual(a, b []domain.Role) bool {
	if len(a) != len(b) {
		return false
	}
	set := make(map[domain.Role]int, len(a))
	for _, r := range a {
		set[r]++
	}
	for _, r := range b {
		set[r]--
		if set[r] < 0 {
			return false
		}
	}
	return true
}

// EnrollmentSecret returns the TOTP secret for a valid enrollment token.
func (s *AuthService) EnrollmentSecret(ctx context.Context, enrollmentToken string) (secret, login string, err error) {
	userID, login, err := s.token.ParseEnrollment(enrollmentToken)
	if err != nil {
		return "", "", err
	}
	secret, err = s.mfa.EnsureEnrollmentSecret(ctx, userID)
	if err != nil {
		return "", "", err
	}
	if secret == "" {
		return "", "", domain.ErrMFANotEnabled
	}
	return secret, login, nil
}
