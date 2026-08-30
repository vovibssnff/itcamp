package service

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"github.com/itcamp/ktc/services/orchestrator/internal/client"
)

func TestSessionRunner_PauseAndResume(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	sim := client.NewMockSimClient()
	svc := &SessionService{sim: sim, log: log, runners: make(map[string]*SessionRunner)}
	runner := newSessionRunner("s1", "sc-1", svc, log)
	if runner.isPaused() {
		t.Fatal("expected not paused initially")
	}
	runner.pause()
	if !runner.isPaused() {
		t.Fatal("expected paused")
	}
	runner.resume()
	if runner.isPaused() {
		t.Fatal("expected resumed")
	}
}

func TestCurrentModelTime_PrefersSimState(t *testing.T) {
	ctx := context.Background()
	sim := client.NewMockSimClient()
	if err := sim.CreateSession(ctx, "s1", nil, 0); err != nil {
		t.Fatal(err)
	}
	st := sim.States["s1"]
	st.ModelTime = 180.5
	sim.States["s1"] = st

	svc := &SessionService{sim: sim}
	if got := svc.currentModelTime(ctx, "s1", 0); got != 180.5 {
		t.Fatalf("currentModelTime = %v, want 180.5 (must not fall back to 0)", got)
	}
}

func TestCurrentModelTime_FallbackWhenSimMissing(t *testing.T) {
	svc := &SessionService{sim: client.NewMockSimClient()}
	if got := svc.currentModelTime(context.Background(), "missing", 42); got != 42 {
		t.Fatalf("currentModelTime = %v, want fallback 42", got)
	}
}

func TestCurrentModelTime_FallbackAfterDestroy(t *testing.T) {
	ctx := context.Background()
	sim := client.NewMockSimClient()
	if err := sim.CreateSession(ctx, "s1", nil, 0); err != nil {
		t.Fatal(err)
	}
	st := sim.States["s1"]
	st.ModelTime = 900
	sim.States["s1"] = st
	_ = sim.DestroySession(ctx, "s1")

	svc := &SessionService{sim: sim}
	// Matches Stop() after DestroySession: must keep last known DB clock, not 0.
	if got := svc.currentModelTime(ctx, "s1", 900); got != 900 {
		t.Fatalf("currentModelTime after destroy = %v, want fallback 900", got)
	}
}

func TestMockSimStepTags(t *testing.T) {
	sim := client.NewMockSimClient()
	ctx := context.Background()
	_ = sim.CreateSession(ctx, "s1", nil, 0)
	st, err := sim.Step(ctx, "s1", 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(st.Tags) == 0 {
		t.Fatal("expected mock tags")
	}
	found := false
	for _, tag := range st.Tags {
		if tag.TagID == "PRSA 204" {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("expected ЭЛОУ tag PRSA 204")
	}
}
