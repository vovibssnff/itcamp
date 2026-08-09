package service

import (
	"context"
	"errors"
	"log/slog"
	"sync"

	"github.com/itcamp/ktc/services/sim-manager/internal/domain"
	"github.com/itcamp/ktc/services/sim-manager/internal/provider"
)

type ManagerService struct {
	provider     provider.RuntimeProvider
	maxInstances int
	workerImage  string
	cpuRequest   string
	memRequest   string
	log          *slog.Logger

	mu       sync.Mutex
	sessions map[string]domain.InstanceStatus
}

func NewManagerService(
	p provider.RuntimeProvider,
	maxInstances int,
	workerImage, cpuRequest, memRequest string,
	log *slog.Logger,
) *ManagerService {
	return &ManagerService{
		provider:     p,
		maxInstances: maxInstances,
		workerImage:  workerImage,
		cpuRequest:   cpuRequest,
		memRequest:   memRequest,
		log:          log,
		sessions:     make(map[string]domain.InstanceStatus),
	}
}

func (s *ManagerService) CreateSession(ctx context.Context, req domain.CreateSessionRequest) (domain.InstanceStatus, error) {
	if req.SessionID == "" {
		return domain.InstanceStatus{}, domain.ErrInvalidSpec
	}

	s.mu.Lock()
	if existing, ok := s.sessions[req.SessionID]; ok {
		s.mu.Unlock()
		return existing, nil
	}
	if len(s.sessions) >= s.maxInstances {
		s.mu.Unlock()
		return domain.InstanceStatus{}, domain.ErrQuotaExceeded
	}
	s.sessions[req.SessionID] = domain.InstanceStatus{SessionID: req.SessionID, Phase: domain.PhaseCreated}
	s.mu.Unlock()

	image := s.workerImage
	if req.Image != "" {
		image = req.Image
	}

	spec := domain.InstanceSpec{
		SessionID:    req.SessionID,
		Image:        image,
		InitStateRef: req.InitStateRef,
		CPURequest:   s.cpuRequest,
		MemRequest:   s.memRequest,
	}

	status, err := s.provider.EnsureInstance(ctx, req.SessionID, spec)
	if err != nil {
		s.mu.Lock()
		s.sessions[req.SessionID] = domain.InstanceStatus{SessionID: req.SessionID, Phase: domain.PhaseFailed, Error: err.Error()}
		s.mu.Unlock()
		return domain.InstanceStatus{}, err
	}

	s.mu.Lock()
	s.sessions[req.SessionID] = status
	s.mu.Unlock()

	s.log.Info("session created", "session", req.SessionID, "phase", status.Phase, "endpoint", status.Endpoint)
	return status, nil
}

func (s *ManagerService) StopSession(ctx context.Context, sessionID string) error {
	s.mu.Lock()
	_, ok := s.sessions[sessionID]
	if !ok {
		s.mu.Unlock()
		return domain.ErrSessionNotFound
	}
	delete(s.sessions, sessionID)
	s.mu.Unlock()

	if err := s.provider.StopInstance(ctx, sessionID); err != nil {
		if errors.Is(err, domain.ErrSessionNotFound) {
			return nil
		}
		return err
	}

	s.log.Info("session stopped", "session", sessionID)
	return nil
}

func (s *ManagerService) GetStatus(ctx context.Context, sessionID string) (domain.InstanceStatus, error) {
	s.mu.Lock()
	cached, ok := s.sessions[sessionID]
	s.mu.Unlock()
	if !ok {
		return domain.InstanceStatus{}, domain.ErrSessionNotFound
	}

	status, err := s.provider.GetStatus(ctx, sessionID)
	if err != nil {
		if errors.Is(err, domain.ErrSessionNotFound) {
			return cached, nil
		}
		return domain.InstanceStatus{}, err
	}

	s.mu.Lock()
	s.sessions[sessionID] = status
	s.mu.Unlock()

	return status, nil
}

func (s *ManagerService) ListSessions(ctx context.Context) (domain.ListSessionsResponse, error) {
	instances, err := s.provider.ListInstances(ctx)
	if err != nil {
		return domain.ListSessionsResponse{}, err
	}

	s.mu.Lock()
	count := len(s.sessions)
	s.mu.Unlock()

	return domain.ListSessionsResponse{
		Instances:    instances,
		Total:        count,
		MaxInstances: s.maxInstances,
	}, nil
}
