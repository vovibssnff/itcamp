package service

import (
	"context"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
	"github.com/itcamp/ktc/services/scenario/internal/repository"
)

type FaultService struct {
	repo *repository.FaultRepo
}

func NewFaultService(repo *repository.FaultRepo) *FaultService {
	return &FaultService{repo: repo}
}

func (s *FaultService) Get(ctx context.Context, faultID string) (domain.Fault, error) {
	return s.repo.GetByID(ctx, faultID)
}

func (s *FaultService) List(ctx context.Context, componentType, severity string) ([]domain.Fault, error) {
	return s.repo.List(ctx, componentType, severity)
}

func (s *FaultService) Seed(ctx context.Context, faults []domain.Fault) error {
	for _, f := range faults {
		if err := s.repo.Upsert(ctx, f); err != nil {
			return err
		}
	}
	return nil
}
