package service

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

type mockTelemetryStore struct {
	telemetry domain.Telemetry
	err       error
}

func (m *mockTelemetryStore) SaveTelemetry(ctx context.Context, sessionID string, t domain.Telemetry) error {
	return m.err
}

func (m *mockTelemetryStore) GetTelemetry(ctx context.Context, sessionID string) (domain.Telemetry, error) {
	return m.telemetry, m.err
}

func (m *mockTelemetryStore) DeleteTelemetry(ctx context.Context, sessionID string) error {
	return m.err
}

func TestLatestTelemetry_ReturnsStoredSnapshot(t *testing.T) {
	want := domain.Telemetry{
		ModelTime: 42.0,
		Tags:      []domain.Tag{{TagID: "T-001", Value: 12.5}},
	}
	svc := &SessionService{cache: &mockTelemetryStore{telemetry: want, err: nil}}

	got, err := svc.LatestTelemetry(context.Background(), "sess-1")
	if err != nil {
		t.Fatalf("LatestTelemetry() error = %v, want nil", err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("LatestTelemetry() = %+v, want %+v", got, want)
	}
}

func TestLatestTelemetry_NotFound(t *testing.T) {
	svc := &SessionService{cache: &mockTelemetryStore{err: domain.ErrTelemetryNotFound}}

	_, err := svc.LatestTelemetry(context.Background(), "sess-missing")
	if !errors.Is(err, domain.ErrTelemetryNotFound) {
		t.Fatalf("LatestTelemetry() error = %v, want ErrTelemetryNotFound", err)
	}
}

func TestLatestTelemetry_PropagatesStoreError(t *testing.T) {
	wantErr := errors.New("redis unavailable")
	svc := &SessionService{cache: &mockTelemetryStore{err: wantErr}}

	_, err := svc.LatestTelemetry(context.Background(), "sess-2")
	if !errors.Is(err, wantErr) {
		t.Fatalf("LatestTelemetry() error = %v, want %v", err, wantErr)
	}
}
