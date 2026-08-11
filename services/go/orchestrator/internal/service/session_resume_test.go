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
