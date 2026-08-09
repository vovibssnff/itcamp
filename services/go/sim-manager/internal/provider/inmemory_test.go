package provider

import (
	"context"
	"testing"

	"github.com/itcamp/ktc/services/sim-manager/internal/domain"
)

func mustEnsure(t *testing.T, p *InMemoryProvider, sessionID string) domain.InstanceStatus {
	t.Helper()
	status, err := p.EnsureInstance(context.Background(), sessionID, domain.InstanceSpec{SessionID: sessionID})
	if err != nil {
		t.Fatalf("EnsureInstance(%s): %v", sessionID, err)
	}
	return status
}

func TestInMemoryProvider_EnsureInstance(t *testing.T) {
	p := NewInMemoryProvider(50060)
	status := mustEnsure(t, p, "sess-1")
	if status.Phase != domain.PhaseReady {
		t.Errorf("expected ready, got %s", status.Phase)
	}
	if status.Endpoint == "" {
		t.Error("expected non-empty endpoint")
	}
}

func TestInMemoryProvider_EnsureInstance_Idempotent(t *testing.T) {
	p := NewInMemoryProvider(50060)
	s1 := mustEnsure(t, p, "sess-1")
	s2 := mustEnsure(t, p, "sess-1")
	if s1.Endpoint != s2.Endpoint {
		t.Error("idempotent ensure should return same endpoint")
	}
}

func TestInMemoryProvider_StopInstance(t *testing.T) {
	p := NewInMemoryProvider(50060)
	mustEnsure(t, p, "sess-1")
	if err := p.StopInstance(context.Background(), "sess-1"); err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	_, err := p.GetStatus(context.Background(), "sess-1")
	if err != domain.ErrSessionNotFound {
		t.Errorf("expected not found, got %v", err)
	}
}

func TestInMemoryProvider_StopInstance_NotFound(t *testing.T) {
	p := NewInMemoryProvider(50060)
	err := p.StopInstance(context.Background(), "nonexistent")
	if err != domain.ErrSessionNotFound {
		t.Fatalf("expected not found, got %v", err)
	}
}

func TestInMemoryProvider_GetStatus_NotFound(t *testing.T) {
	p := NewInMemoryProvider(50060)
	_, err := p.GetStatus(context.Background(), "nonexistent")
	if err != domain.ErrSessionNotFound {
		t.Fatalf("expected not found, got %v", err)
	}
}

func TestInMemoryProvider_ListInstances_Empty(t *testing.T) {
	p := NewInMemoryProvider(50060)
	list, err := p.ListInstances(context.Background())
	if err != nil {
		t.Fatalf("ListInstances: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected 0, got %d", len(list))
	}
}

func TestInMemoryProvider_ListInstances_Multiple(t *testing.T) {
	p := NewInMemoryProvider(50060)
	mustEnsure(t, p, "sess-1")
	mustEnsure(t, p, "sess-2")
	list, err := p.ListInstances(context.Background())
	if err != nil {
		t.Fatalf("ListInstances: %v", err)
	}
	if len(list) != 2 {
		t.Errorf("expected 2, got %d", len(list))
	}
}

func TestInMemoryProvider_SequentialPorts(t *testing.T) {
	p := NewInMemoryProvider(50060)
	s1 := mustEnsure(t, p, "sess-1")
	s2 := mustEnsure(t, p, "sess-2")
	if s1.Endpoint == s2.Endpoint {
		t.Error("expected different endpoints for different sessions")
	}
}
