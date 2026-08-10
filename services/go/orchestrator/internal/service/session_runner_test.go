package service

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/itcamp/ktc/services/orchestrator/internal/client"
)

func TestSessionRunner_ContinuesAfterRequestContextCancel(t *testing.T) {
	sim := client.NewMockSimClient()
	if err := sim.CreateSession(context.Background(), "sess-1", nil, 0); err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	svc := &SessionService{
		sim:        sim,
		hub:        NewWSHub(),
		assessment: client.NewMockAssessmentClient(),
		log:        slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	runner := newSessionRunner("sess-1", "", svc, svc.log)

	// Mimic net/http: the caller cancels the request context when ServeHTTP returns.
	reqCtx, cancel := context.WithCancel(context.Background())
	cancel()

	done := make(chan struct{})
	go func() {
		runner.run(context.WithoutCancel(reqCtx))
		close(done)
	}()

	deadline := time.After(3 * time.Second)
	for {
		state, err := sim.GetState(context.Background(), "sess-1")
		if err == nil && state.ModelTime > 0 {
			runner.stop()
			break
		}
		select {
		case <-deadline:
			t.Fatal("session runner exited or stalled after request context cancel; expected sim ticks to continue")
		case <-time.After(50 * time.Millisecond):
		}
	}

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("session runner did not stop after stop()")
	}
}

func TestSessionRunner_ExitsWhenContextCanceled(t *testing.T) {
	sim := client.NewMockSimClient()
	if err := sim.CreateSession(context.Background(), "sess-2", nil, 0); err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	svc := &SessionService{
		sim: sim,
		hub: NewWSHub(),
		log: slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	runner := newSessionRunner("sess-2", "", svc, svc.log)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	done := make(chan struct{})
	go func() {
		runner.run(ctx)
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("session runner should exit promptly when its run context is canceled")
	}

	state, err := sim.GetState(context.Background(), "sess-2")
	if err != nil {
		t.Fatalf("GetState: %v", err)
	}
	if state.ModelTime != 0 {
		t.Fatalf("expected no ticks after immediate cancel, model_time=%v", state.ModelTime)
	}
}
