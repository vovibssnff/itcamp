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
	cfg       config.SecurityConfig
	userRepo  *repository.UserRepo
	ldap      *security.LDAPClient
	token     *TokenService
	mfa       *MFAService
	attempts  *repository.LoginAttemptRepo
	audit     *AuditService
	log       *slog.Logger
}

func NewAuthService(
	cfg config.SecurityConfig,
	userRepo *repository.UserRepo,
	ldap *security.LDAPClient,
	token *TokenService,
	mfa *MFAService,
	attempts *repository.LoginAttemptRepo,
	audit *AuditService,
	log *slog.Logger,
) *AuthService {
	return &AuthService{
		cfg: cfg, userRepo: userRepo, ldap: ldap, token: token, mfa: mfa,
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
}

func (s *AuthService) Login(ctx context.Context, in LoginInput) (LoginResult, error) {
	if locked, err := s.isLocked(ctx, in.Login); err != nil {
		return LoginResult{}, err
	} else if locked {
		return LoginResult{}, domain.ErrTooManyAttempts
	}

	ldapUser, err := s.ldap.Authenticate(ctx, in.Login, in.Password)
	if err != nil {
		s.recordFailedAttempt(ctx, in.Login, in.IP, "")
		if errors.Is(err, domain.ErrInvalidCredentials) {
			return LoginResult{}, domain.ErrInvalidCredentials
		}
		return LoginResult{}, err
	}

	user, err := s.userRepo.GetByLDAPDN(ctx, ldapUser.DN)
	if errors.Is(err, domain.ErrUserNotFound) {
		user = s.buildUserFromLDAP(ldapUser)
		if err := s.userRepo.Create(ctx, user); err != nil && !errors.Is(err, domain.ErrLoginTaken) {
			return LoginResult{}, err
		}
	} else if err != nil {
		return LoginResult{}, err
	} else {
		if changed := s.syncUserFromLDAP(&user, ldapUser); changed {
			_ = s.userRepo.Update(ctx, user)
		}
	}

	if user.Status == domain.UserStatusDisabled {
		return LoginResult{}, domain.ErrUserDisabled
	}
	if user.Status == domain.UserStatusLocked {
		return LoginResult{}, domain.ErrUserLocked
	}

	if user.MFAEnabled || user.IsPrivileged() {
		if in.MFACode == "" {
			s.audit.Log(ctx, AuditLoginMFARequired, user.ID, in.IP)
			return LoginResult{MFANeeded: true, User: user}, domain.ErrMFARequired
		}
		if err := s.mfa.Verify(ctx, user.ID, in.MFACode); err != nil {
			s.recordFailedAttempt(ctx, in.Login, in.IP, user.ID)
			return LoginResult{}, err
		}
	}

	tokens, err := s.token.Issue(ctx, user)
	if err != nil {
		return LoginResult{}, err
	}

	s.recordSuccessfulAttempt(ctx, in.Login, in.IP, user.ID)
	s.audit.Log(ctx, AuditLoginSuccess, user.ID, in.IP)
	return LoginResult{Tokens: tokens, User: user}, nil
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	return s.token.Revoke(ctx, refreshToken)
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (domain.TokenPair, error) {
	return s.token.Refresh(ctx, refreshToken)
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

func (s *AuthService) buildUserFromLDAP(ldapUser security.LDAPUser) domain.User {
	return domain.User{
		ID:       newUUID(),
		Login:    ldapUser.Login,
		FullName: ldapUser.FullName,
		LDAPDN:   ldapUser.DN,
		Roles:    s.ldap.MapRoles(ldapUser.Groups),
		Status:   domain.UserStatusActive,
	}
}

func (s *AuthService) syncUserFromLDAP(user *domain.User, ldapUser security.LDAPUser) bool {
	changed := false
	if user.FullName != ldapUser.FullName {
		user.FullName = ldapUser.FullName
		changed = true
	}
	newRoles := s.ldap.MapRoles(ldapUser.Groups)
	if !rolesEqual(user.Roles, newRoles) {
		user.Roles = newRoles
		changed = true
	}
	return changed
}

func rolesEqual(a, b []domain.Role) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
