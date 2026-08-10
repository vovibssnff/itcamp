package service

import (
	"context"

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
	roles, err := s.repo.GetRoles(ctx, id)
	if err != nil {
		return domain.User{}, err
	}
	u.Roles = roles
	return u, nil
}

func (s *UserService) List(ctx context.Context) ([]domain.User, error) {
	users, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}
	for i := range users {
		roles, err := s.repo.GetRoles(ctx, users[i].ID)
		if err != nil {
			return nil, err
		}
		users[i].Roles = roles
	}
	return users, nil
}
