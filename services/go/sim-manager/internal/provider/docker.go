package provider

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"

	"github.com/itcamp/ktc/services/sim-manager/internal/domain"
)

const (
	workerLabelKey = "itcamp.ktc/sim-worker"
	workerLabelVal = "true"
	sessLabelKey   = "itcamp.ktc/session"
)

// DockerProvider поднимает отдельный контейнер sim-worker на каждую сессию
// через Docker Engine API (docker.sock). Каждый инстанс — реальный изолированный
// контейнер. Хост-порты выделяет сам Docker (PublishAllPorts) — это исключает
// коллизии между параллельными сессиями и постоянными сервисами compose.
type DockerProvider struct {
	cli       *client.Client
	image     string
	network   string
	cpuReq    string
	memReq    string
	startWait time.Duration
	log       *slog.Logger
}

func NewDockerProvider(ctx context.Context, dockerHost, image, network, cpuReq, memReq string, portBase int, log *slog.Logger) (*DockerProvider, error) {
	opts := []client.Opt{client.FromEnv}
	if dockerHost != "" {
		opts = []client.Opt{client.WithHost(dockerHost)}
	}
	cli, err := client.NewClientWithOpts(opts...)
	if err != nil {
		return nil, fmt.Errorf("docker client: %w", err)
	}
	cli.NegotiateAPIVersion(ctx)

	return &DockerProvider{
		cli:       cli,
		image:     image,
		network:   network,
		cpuReq:    cpuReq,
		memReq:    memReq,
		startWait: 90 * time.Second,
		log:       log,
	}, nil
}

func (p *DockerProvider) name(sessionID string) string {
	return "sim-worker-" + sanitize(sessionID)
}

// EnsureInstance создаёт (если ещё нет) контейнер sim-worker для сессии,
// пробрасывает уникальные хост-порты и ждёт готовности healthz.
func (p *DockerProvider) EnsureInstance(ctx context.Context, sessionID string, spec domain.InstanceSpec) (domain.InstanceStatus, error) {
	containerName := p.name(sessionID)

	if existing, err := p.cli.ContainerInspect(ctx, containerName); err == nil {
		return p.statusFromJSON(sessionID, existing), nil
	}

	// Prefer the provider's configured image; ignore client-supplied overrides
	// so docker.sock cannot be used to pull arbitrary images.
	image := p.image
	if image == "" {
		image = spec.Image
	}
	if err := p.ensureImage(ctx, image); err != nil {
		return domain.InstanceStatus{}, err
	}

	hostCfg := &container.HostConfig{
		NetworkMode:     container.NetworkMode(p.network),
		PublishAllPorts: true,
		Resources: container.Resources{
			NanoCPUs: parseCPU(spec.CPURequest, p.cpuReq),
			Memory:   parseMemory(spec.MemRequest, p.memReq),
		},
	}

	cfg := &container.Config{
		Image: image,
		Env: []string{
			"KTC_SIM_REST_PORT=8081",
			"KTC_SIM_GRPC_PORT=50061",
			"KTC_SIM_DATA_DIR=/app/data",
		},
		ExposedPorts: nat.PortSet{
			"8081/tcp":  {},
			"50061/tcp": {},
		},
		Labels: map[string]string{
			workerLabelKey: workerLabelVal,
			sessLabelKey:   sessionID,
		},
	}

	createResp, err := p.cli.ContainerCreate(ctx, cfg, hostCfg, &network.NetworkingConfig{}, nil, containerName)
	if err != nil {
		return domain.InstanceStatus{}, fmt.Errorf("%w: %v", domain.ErrInstanceFailed, err)
	}

	if err := p.cli.ContainerStart(ctx, createResp.ID, container.StartOptions{}); err != nil {
		_ = p.cli.ContainerRemove(ctx, createResp.ID, container.RemoveOptions{Force: true})
		return domain.InstanceStatus{}, fmt.Errorf("%w: %v", domain.ErrInstanceFailed, err)
	}

	status := domain.InstanceStatus{
		SessionID: sessionID,
		Phase:     domain.PhasePending,
	}
	// Docker сам выбирает свободные хост-порты — считываем фактические
	// назначения для endpoint'а.
	if insp, err := p.cli.ContainerInspect(ctx, createResp.ID); err == nil {
		status.Endpoint = fmt.Sprintf("localhost:%d", restPortOf(insp))
	}
	if err := p.waitReady(ctx, containerName); err != nil {
		_ = p.cli.ContainerRemove(ctx, createResp.ID, container.RemoveOptions{Force: true})
		return domain.InstanceStatus{}, fmt.Errorf("%w: %v", domain.ErrInstanceFailed, err)
	}
	status.Phase = domain.PhaseReady
	return status, nil
}

// waitReady ждёт, пока healthz REST-эндпоинта контейнера ответит 200.
// Рабочая машина и sim-manager живут в одной docker-сети, поэтому обращаемся
// к контейнеру по его имени во внутренней сети (host-порт недоступен изнутри
// контейнера sim-manager'а).
func (p *DockerProvider) waitReady(ctx context.Context, containerName string) error {
	deadline := time.Now().Add(p.startWait)
	url := fmt.Sprintf("http://%s:8081/healthz", containerName)
	for time.Now().Before(deadline) {
		if err := ctx.Err(); err != nil {
			return err
		}
		resp, err := http.Get(url)
		if err == nil {
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}
		time.Sleep(1 * time.Second)
	}
	return fmt.Errorf("worker %s not ready within %s", containerName, p.startWait)
}

func (p *DockerProvider) StopInstance(ctx context.Context, sessionID string) error {
	containerName := p.name(sessionID)
	insp, err := p.cli.ContainerInspect(ctx, containerName)
	if err != nil {
		if client.IsErrNotFound(err) {
			return domain.ErrSessionNotFound
		}
		return err
	}
	_ = p.cli.ContainerStop(ctx, insp.ID, container.StopOptions{Timeout: ptr(10)})
	_ = p.cli.ContainerRemove(ctx, insp.ID, container.RemoveOptions{Force: true})
	return nil
}

func (p *DockerProvider) GetStatus(ctx context.Context, sessionID string) (domain.InstanceStatus, error) {
	insp, err := p.cli.ContainerInspect(ctx, p.name(sessionID))
	if err != nil {
		if client.IsErrNotFound(err) {
			return domain.InstanceStatus{}, domain.ErrSessionNotFound
		}
		return domain.InstanceStatus{}, err
	}
	return p.statusFromJSON(sessionID, insp), nil
}

func (p *DockerProvider) ListInstances(ctx context.Context) ([]domain.InstanceStatus, error) {
	containers, err := p.cli.ContainerList(ctx, container.ListOptions{
		Filters: filters.NewArgs(
			filters.Arg("label", workerLabelKey+"="+workerLabelVal),
		),
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(containers, func(i, j int) bool {
		ni, nj := "", ""
		if len(containers[i].Names) > 0 {
			ni = containers[i].Names[0]
		}
		if len(containers[j].Names) > 0 {
			nj = containers[j].Names[0]
		}
		return ni < nj
	})
	result := make([]domain.InstanceStatus, 0, len(containers))
	for _, c := range containers {
		sess := c.Labels[sessLabelKey]
		result = append(result, p.statusFromContainer(c, sess))
	}
	return result, nil
}

func (p *DockerProvider) statusFromJSON(sessionID string, insp types.ContainerJSON) domain.InstanceStatus {
	state := ""
	if insp.State != nil {
		state = insp.State.Status
	}
	return p.statusFromFields(sessionID, state, restPortOf(insp))
}

func (p *DockerProvider) statusFromContainer(c types.Container, sessionID string) domain.InstanceStatus {
	port := int(0)
	if len(c.Ports) > 0 {
		for _, pr := range c.Ports {
			if pr.PrivatePort == 8081 {
				port = int(pr.PublicPort)
				break
			}
		}
	}
	return p.statusFromFields(sessionID, c.State, port)
}

func (p *DockerProvider) statusFromFields(sessionID, state string, port int) domain.InstanceStatus {
	var phase domain.Phase
	switch state {
	case "running":
		phase = domain.PhaseReady
	case "created", "restarting", "paused":
		phase = domain.PhasePending
	default:
		phase = domain.PhaseStopped
	}
	return domain.InstanceStatus{
		SessionID: sessionID,
		Phase:     phase,
		Endpoint:  fmt.Sprintf("localhost:%d", port),
	}
}

func (p *DockerProvider) ensureImage(ctx context.Context, ref string) error {
	_, _, err := p.cli.ImageInspectWithRaw(ctx, ref)
	if err == nil {
		return nil
	}
	if !client.IsErrNotFound(err) {
		return err
	}
	rd, err := p.cli.ImagePull(ctx, ref, image.PullOptions{})
	if err != nil {
		return fmt.Errorf("image pull %s: %w", ref, err)
	}
	defer rd.Close()
	_, _ = io.Copy(io.Discard, rd)
	return nil
}

// restPortOf возвращает фактический host-порт, который Docker назначил для
// REST Model API (8081) контейнера. Читается из NetworkSettings.Ports —
// при PublishAllPorts реальные привязки лежат там, а не в HostConfig.
func restPortOf(insp types.ContainerJSON) int {
	if insp.NetworkSettings == nil {
		return 0
	}
	for _, b := range insp.NetworkSettings.Ports["8081/tcp"] {
		n, err := atoi(b.HostPort)
		if err == nil {
			return n
		}
	}
	return 0
}

func sanitize(s string) string {
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		} else {
			b.WriteByte('-')
		}
	}
	if b.Len() == 0 {
		return "sess"
	}
	return b.String()
}

func parseCPU(specVal, def string) int64 {
	v := specVal
	if v == "" {
		v = def
	}
	return milliCPU(v)
}

func milliCPU(v string) int64 {
	v = strings.TrimSpace(v)
	if strings.HasSuffix(v, "m") {
		n, err := atoi(strings.TrimSuffix(v, "m"))
		if err != nil {
			return 0
		}
		return int64(n) * 1_000_000
	}
	return 0
}

func parseMemory(specVal, def string) int64 {
	v := specVal
	if v == "" {
		v = def
	}
	return byteMem(v)
}

func byteMem(v string) int64 {
	v = strings.TrimSpace(v)
	mult := int64(1)
	switch {
	case strings.HasSuffix(v, "Gi"):
		mult = 1 << 30
		v = strings.TrimSuffix(v, "Gi")
	case strings.HasSuffix(v, "Mi"):
		mult = 1 << 20
		v = strings.TrimSuffix(v, "Mi")
	case strings.HasSuffix(v, "Ki"):
		mult = 1 << 10
		v = strings.TrimSuffix(v, "Ki")
	case strings.HasSuffix(v, "G"):
		mult = 1 << 30
		v = strings.TrimSuffix(v, "G")
	case strings.HasSuffix(v, "M"):
		mult = 1 << 20
		v = strings.TrimSuffix(v, "M")
	case strings.HasSuffix(v, "K"):
		mult = 1 << 10
		v = strings.TrimSuffix(v, "K")
	}
	n, err := atoi(v)
	if err != nil {
		return 0
	}
	return int64(n) * mult
}

func atoi(s string) (int, error) {
	n := 0
	if s == "" {
		return 0, fmt.Errorf("empty")
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return 0, fmt.Errorf("not a number")
		}
		n = n*10 + int(r-'0')
	}
	return n, nil
}

func ptr(v int) *int { return &v }
