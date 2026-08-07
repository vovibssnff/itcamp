package service

import (
	"context"
	"fmt"

	"github.com/itcamp/ktc/services/auth/internal/domain"
	"github.com/itcamp/ktc/services/auth/internal/repository"
)

type UserService struct {
	repo  *repository.UserRepo
	audit *AuditService
}

func NewUserService(repo *repository.UserRepo, audit *AuditService) *UserService {
	return &UserService{repo: repo, audit: audit}
}

func (s *UserService) GetByID(ctx context.Context, id string) (domain.User, error) {
	u, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.User{}, err
	}
	u.Roles, _ = s.repo.GetRoles(ctx, id)
	return u, nil
}

func (s *UserService) List(ctx context.Context) ([]domain.User, error) {
	users, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}
	for i := range users {
		users[i].Roles, _ = s.repo.GetRoles(ctx, users[i].ID)
	}
	return users, nil
}

type CreateUserInput struct {
	Login    string
	FullName string
	LDAPDN   string
	Roles    []domain.Role
}

func (s *UserService) Create(ctx context.Context, in CreateUserInput) (domain.User, error) {
	if err := s.repo.EnsureRolesExist(ctx, in.Roles); err != nil {
		return domain.User{}, err
	}
	user := domain.User{
		ID:       newUUID(),
		Login:    in.Login,
		FullName: in.FullName,
		LDAPDN:   in.LDAPDN,
		Roles:    in.Roles,
		Status:   domain.UserStatusActive,
	}
	if err := s.repo.Create(ctx, user); err != nil {
		return domain.User{}, err
	}
	if err := s.repo.SetRoles(ctx, user.ID, in.Roles); err != nil {
		return domain.User{}, err
	}
	s.audit.LogDetail(ctx, AuditUserCreated, user.ID, "", fmt.Sprintf("login=%s", in.Login))
	return user, nil
}

type UpdateUserInput struct {
	FullName string
	LDAPDN   string
	Status   domain.UserStatus
	Roles    []domain.Role
}

func (s *UserService) Update(ctx context.Context, id string, in UpdateUserInput) (domain.User, error) {
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.User{}, err
	}
	if in.FullName != "" {
		user.FullName = in.FullName
	}
	if in.LDAPDN != "" {
		user.LDAPDN = in.LDAPDN
	}
	if in.Status != "" {
		user.Status = in.Status
	}
	if err := s.repo.Update(ctx, user); err != nil {
		return domain.User{}, err
	}
	if in.Roles != nil {
		if err := s.repo.EnsureRolesExist(ctx, in.Roles); err != nil {
			return domain.User{}, err
		}
		if err := s.repo.SetRoles(ctx, id, in.Roles); err != nil {
			return domain.User{}, err
		}
		s.audit.LogDetail(ctx, AuditRolesChanged, id, "", fmt.Sprintf("%v", in.Roles))
	}
	s.audit.Log(ctx, AuditUserUpdated, id, "")
	return s.GetByID(ctx, id)
}

func (s *UserService) Delete(ctx context.Context, id string) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.audit.Log(ctx, AuditUserDeleted, id, "")
	return nil
}
