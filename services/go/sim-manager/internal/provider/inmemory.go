package provider

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/itcamp/ktc/services/sim-manager/internal/domain"
)

type InMemoryProvider struct {
	mu        sync.RWMutex
	instances map[string]domain.InstanceStatus
	portBase  int
	portNext  int
}

func NewInMemoryProvider(portBase int) *InMemoryProvider {
	return &InMemoryProvider{
		instances: make(map[string]domain.InstanceStatus),
		portBase:  portBase,
		portNext:  portBase,
	}
}

func (p *InMemoryProvider) EnsureInstance(_ context.Context, sessionID string, spec domain.InstanceSpec) (domain.InstanceStatus, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if existing, ok := p.instances[sessionID]; ok {
		if existing.Phase == domain.PhaseReady || existing.Phase == domain.PhasePending {
			return existing, nil
		}
	}

	port := p.portNext
	p.portNext++

	status := domain.InstanceStatus{
		SessionID: sessionID,
		Phase:     domain.PhaseReady,
		Endpoint:  fmt.Sprintf("localhost:%d", port),
	}
	p.instances[sessionID] = status

	return status, nil
}

func (p *InMemoryProvider) StopInstance(_ context.Context, sessionID string) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if _, ok := p.instances[sessionID]; !ok {
		return domain.ErrSessionNotFound
	}
	delete(p.instances, sessionID)
	return nil
}

func (p *InMemoryProvider) GetStatus(_ context.Context, sessionID string) (domain.InstanceStatus, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	s, ok := p.instances[sessionID]
	if !ok {
		return domain.InstanceStatus{}, domain.ErrSessionNotFound
	}
	return s, nil
}

func (p *InMemoryProvider) ListInstances(_ context.Context) ([]domain.InstanceStatus, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	result := make([]domain.InstanceStatus, 0, len(p.instances))
	for _, s := range p.instances {
		result = append(result, s)
	}
	return result, nil
}

var _ = time.Now
