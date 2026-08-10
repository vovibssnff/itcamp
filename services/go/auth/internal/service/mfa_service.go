package service

import (
	"context"
	"fmt"

	"github.com/itcamp/ktc/services/auth/internal/domain"
	"github.com/itcamp/ktc/services/auth/internal/repository"
	"github.com/itcamp/ktc/services/auth/internal/security"
)

type MFAService struct {
	repo  *repository.MFARepo
	users *repository.UserRepo
	totp  *security.TOTPService
	audit *AuditService
}

func NewMFAService(repo *repository.MFARepo, users *repository.UserRepo, totp *security.TOTPService, audit *AuditService) *MFAService {
	return &MFAService{repo: repo, users: users, totp: totp, audit: audit}
}

func (s *MFAService) Setup(ctx context.Context, userID string) (string, error) {
	if _, err := s.users.GetByID(ctx, userID); err != nil {
		return "", err
	}
	secret, err := s.totp.GenerateSecret(userID)
	if err != nil {
		return "", err
	}
	enc, err := s.totp.Encrypt(secret)
	if err != nil {
		return "", err
	}
	if err := s.repo.Upsert(ctx, repository.MFARecord{UserID: userID, SecretEnc: enc, Enabled: false}); err != nil {
		return "", err
	}
	return secret, nil
}

func (s *MFAService) Enable(ctx context.Context, userID, code string) error {
	if _, err := s.users.GetByID(ctx, userID); err != nil {
		return err
	}
	rec, err := s.repo.Get(ctx, userID)
	if err != nil {
		return err
	}
	secret, err := s.totp.Decrypt(rec.SecretEnc)
	if err != nil {
		return err
	}
	if !s.totp.Validate(code, secret) {
		return domain.ErrMFAInvalid
	}
	if err := s.repo.SetEnabled(ctx, userID, true); err != nil {
		return err
	}
	s.audit.Log(ctx, AuditMFAEnabled, userID, "")
	return nil
}

func (s *MFAService) Disable(ctx context.Context, userID string) error {
	if err := s.repo.Delete(ctx, userID); err != nil {
		return err
	}
	s.audit.Log(ctx, AuditMFADisabled, userID, "")
	return nil
}

func (s *MFAService) Verify(ctx context.Context, userID, code string) error {
	rec, err := s.repo.Get(ctx, userID)
	if err != nil {
		return domain.ErrMFAInvalid
	}
	secret, err := s.totp.Decrypt(rec.SecretEnc)
	if err != nil {
		return fmt.Errorf("decrypt mfa: %w", err)
	}
	if !s.totp.Validate(code, secret) {
		return domain.ErrMFAInvalid
	}
	return nil
}

func (s *MFAService) IsEnabled(ctx context.Context, userID string) (bool, error) {
	if _, err := s.users.GetByID(ctx, userID); err != nil {
		return false, err
	}
	rec, err := s.repo.Get(ctx, userID)
	if err != nil {
		return false, nil
	}
	return rec.Enabled, nil
}
