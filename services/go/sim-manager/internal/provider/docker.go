package provider

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/itcamp/ktc/services/sim-manager/internal/domain"
)

type DockerProvider struct {
	image        string
	portBase     int
	portNext     int
	containerIDs map[string]string
	log          *slog.Logger
}

func NewDockerProvider(ctx context.Context, dockerHost, image string, portBase int, log *slog.Logger) (*DockerProvider, error) {
	log.Warn("docker provider is a stub — real Docker SDK requires build tags",
		"docker_host", dockerHost)
	return &DockerProvider{
		image:        image,
		portBase:     portBase,
		portNext:     portBase,
		containerIDs: make(map[string]string),
		log:          log,
	}, nil
}

func (p *DockerProvider) EnsureInstance(_ context.Context, sessionID string, _ domain.InstanceSpec) (domain.InstanceStatus, error) {
	port := p.portNext
	p.portNext++
	p.containerIDs[sessionID] = fmt.Sprintf("stub-%s", sessionID)
	return domain.InstanceStatus{
		SessionID: sessionID,
		Phase:     domain.PhaseReady,
		Endpoint:  fmt.Sprintf("localhost:%d", port),
	}, nil
}

func (p *DockerProvider) StopInstance(_ context.Context, sessionID string) error {
	if _, ok := p.containerIDs[sessionID]; !ok {
		return domain.ErrSessionNotFound
	}
	delete(p.containerIDs, sessionID)
	return nil
}

func (p *DockerProvider) GetStatus(_ context.Context, sessionID string) (domain.InstanceStatus, error) {
	if _, ok := p.containerIDs[sessionID]; !ok {
		return domain.InstanceStatus{}, domain.ErrSessionNotFound
	}
	return domain.InstanceStatus{SessionID: sessionID, Phase: domain.PhaseReady}, nil
}

func (p *DockerProvider) ListInstances(_ context.Context) ([]domain.InstanceStatus, error) {
	result := make([]domain.InstanceStatus, 0, len(p.containerIDs))
	for sessionID := range p.containerIDs {
		result = append(result, domain.InstanceStatus{SessionID: sessionID, Phase: domain.PhaseReady})
	}
	return result, nil
}
