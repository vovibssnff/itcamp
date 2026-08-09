package provider

import (
	"context"
	"testing"

	"github.com/itcamp/ktc/services/sim-manager/internal/domain"
)

func TestInMemoryProvider_EnsureInstance(t *testing.T) {
	p := NewInMemoryProvider(50060)
	status, err := p.EnsureInstance(context.Background(), "sess-1", domain.InstanceSpec{SessionID: "sess-1"})
	if err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	if status.Phase != domain.PhaseReady {
		t.Errorf("expected ready, got %s", status.Phase)
	}
	if status.Endpoint == "" {
		t.Error("expected non-empty endpoint")
	}
}

func TestInMemoryProvider_EnsureInstance_Idempotent(t *testing.T) {
	p := NewInMemoryProvider(50060)
	s1, _ := p.EnsureInstance(context.Background(), "sess-1", domain.InstanceSpec{SessionID: "sess-1"})
	s2, _ := p.EnsureInstance(context.Background(), "sess-1", domain.InstanceSpec{SessionID: "sess-1"})
	if s1.Endpoint != s2.Endpoint {
		t.Error("idempotent ensure should return same endpoint")
	}
}

func TestInMemoryProvider_StopInstance(t *testing.T) {
	p := NewInMemoryProvider(50060)
	p.EnsureInstance(context.Background(), "sess-1", domain.InstanceSpec{SessionID: "sess-1"})
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
	list, _ := p.ListInstances(context.Background())
	if len(list) != 0 {
		t.Errorf("expected 0, got %d", len(list))
	}
}

func TestInMemoryProvider_ListInstances_Multiple(t *testing.T) {
	p := NewInMemoryProvider(50060)
	p.EnsureInstance(context.Background(), "sess-1", domain.InstanceSpec{SessionID: "sess-1"})
	p.EnsureInstance(context.Background(), "sess-2", domain.InstanceSpec{SessionID: "sess-2"})
	list, _ := p.ListInstances(context.Background())
	if len(list) != 2 {
		t.Errorf("expected 2, got %d", len(list))
	}
}

func TestInMemoryProvider_SequentialPorts(t *testing.T) {
	p := NewInMemoryProvider(50060)
	s1, _ := p.EnsureInstance(context.Background(), "sess-1", domain.InstanceSpec{SessionID: "sess-1"})
	s2, _ := p.EnsureInstance(context.Background(), "sess-2", domain.InstanceSpec{SessionID: "sess-2"})
	if s1.Endpoint == s2.Endpoint {
		t.Error("expected different endpoints for different sessions")
	}
}
