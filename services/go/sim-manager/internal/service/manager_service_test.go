package service

import (
	"context"
	"log/slog"
	"os"
	"testing"

	"github.com/itcamp/ktc/services/sim-manager/internal/domain"
	"github.com/itcamp/ktc/services/sim-manager/internal/provider"
)

var testLog = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))

func testService(maxInstances int) *ManagerService {
	p := provider.NewInMemoryProvider(50060)
	return NewManagerService(p, maxInstances, "sim-worker:latest", "1000m", "512Mi", testLog)
}

func mustCreate(t *testing.T, svc *ManagerService, sessionID string) domain.InstanceStatus {
	t.Helper()
	status, err := svc.CreateSession(context.Background(), domain.CreateSessionRequest{SessionID: sessionID})
	if err != nil {
		t.Fatalf("CreateSession(%s): %v", sessionID, err)
	}
	return status
}

func TestCreateSession_Success(t *testing.T) {
	svc := testService(50)
	status := mustCreate(t, svc, "sess-1")
	if status.SessionID != "sess-1" {
		t.Errorf("expected sess-1, got %s", status.SessionID)
	}
	if status.Phase != domain.PhaseReady {
		t.Errorf("expected ready, got %s", status.Phase)
	}
	if status.Endpoint == "" {
		t.Error("expected non-empty endpoint")
	}
}

func TestCreateSession_Idempotent(t *testing.T) {
	svc := testService(50)
	status1 := mustCreate(t, svc, "sess-1")
	status2 := mustCreate(t, svc, "sess-1")
	if status1.Endpoint != status2.Endpoint {
		t.Error("idempotent create should return same endpoint")
	}
}

func TestCreateSession_QuotaExceeded(t *testing.T) {
	svc := testService(2)
	mustCreate(t, svc, "sess-1")
	mustCreate(t, svc, "sess-2")
	_, err := svc.CreateSession(context.Background(), domain.CreateSessionRequest{SessionID: "sess-3"})
	if err != domain.ErrQuotaExceeded {
		t.Fatalf("expected quota exceeded, got %v", err)
	}
}

func TestCreateSession_EmptySessionID(t *testing.T) {
	svc := testService(50)
	_, err := svc.CreateSession(context.Background(), domain.CreateSessionRequest{})
	if err != domain.ErrInvalidSpec {
		t.Fatalf("expected invalid spec, got %v", err)
	}
}

func TestStopSession_Success(t *testing.T) {
	svc := testService(50)
	mustCreate(t, svc, "sess-1")
	if err := svc.StopSession(context.Background(), "sess-1"); err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	_, err := svc.GetStatus(context.Background(), "sess-1")
	if err != domain.ErrSessionNotFound {
		t.Errorf("expected not found after stop, got %v", err)
	}
}

func TestStopSession_NotFound(t *testing.T) {
	svc := testService(50)
	err := svc.StopSession(context.Background(), "nonexistent")
	if err != domain.ErrSessionNotFound {
		t.Fatalf("expected not found, got %v", err)
	}
}

func TestStopSession_QuotaFreed(t *testing.T) {
	svc := testService(1)
	mustCreate(t, svc, "sess-1")
	if err := svc.StopSession(context.Background(), "sess-1"); err != nil {
		t.Fatalf("StopSession: %v", err)
	}
	_, err := svc.CreateSession(context.Background(), domain.CreateSessionRequest{SessionID: "sess-2"})
	if err != nil {
		t.Fatalf("expected success after freeing quota, got %v", err)
	}
}

func TestGetStatus_Success(t *testing.T) {
	svc := testService(50)
	mustCreate(t, svc, "sess-1")
	status, err := svc.GetStatus(context.Background(), "sess-1")
	if err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	if status.Phase != domain.PhaseReady {
		t.Errorf("expected ready, got %s", status.Phase)
	}
}

func TestGetStatus_NotFound(t *testing.T) {
	svc := testService(50)
	_, err := svc.GetStatus(context.Background(), "nonexistent")
	if err != domain.ErrSessionNotFound {
		t.Fatalf("expected not found, got %v", err)
	}
}

func TestListSessions_Empty(t *testing.T) {
	svc := testService(50)
	resp, err := svc.ListSessions(context.Background())
	if err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	if resp.Total != 0 {
		t.Errorf("expected 0 sessions, got %d", resp.Total)
	}
	if resp.MaxInstances != 50 {
		t.Errorf("expected max 50, got %d", resp.MaxInstances)
	}
}

func TestListSessions_AfterCreate(t *testing.T) {
	svc := testService(50)
	mustCreate(t, svc, "sess-1")
	mustCreate(t, svc, "sess-2")
	resp, err := svc.ListSessions(context.Background())
	if err != nil {
		t.Fatalf("ListSessions: %v", err)
	}
	if resp.Total != 2 {
		t.Errorf("expected 2 sessions, got %d", resp.Total)
	}
}

func TestListSessions_AfterStop(t *testing.T) {
	svc := testService(50)
	mustCreate(t, svc, "sess-1")
	mustCreate(t, svc, "sess-2")
	if err := svc.StopSession(context.Background(), "sess-1"); err != nil {
		t.Fatalf("StopSession: %v", err)
	}
	resp, err := svc.ListSessions(context.Background())
	if err != nil {
		t.Fatalf("ListSessions: %v", err)
	}
	if resp.Total != 1 {
		t.Errorf("expected 1 session after stop, got %d", resp.Total)
	}
}
