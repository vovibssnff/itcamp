package provider

import (
	"context"

	"github.com/itcamp/ktc/services/sim-manager/internal/domain"
)

type RuntimeProvider interface {
	EnsureInstance(ctx context.Context, sessionID string, spec domain.InstanceSpec) (domain.InstanceStatus, error)
	StopInstance(ctx context.Context, sessionID string) error
	GetStatus(ctx context.Context, sessionID string) (domain.InstanceStatus, error)
	ListInstances(ctx context.Context) ([]domain.InstanceStatus, error)
}
