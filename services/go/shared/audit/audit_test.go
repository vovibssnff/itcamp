package audit

import (
	"bytes"
	"context"
	"log/slog"
	"strings"
	"sync"
	"testing"
)

type recordBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *recordBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func TestEmit_ActorAndEvent(t *testing.T) {
	var buf recordBuffer
	log := slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelInfo}))

	ctx := WithActor(context.Background(), "user-42")
	Emit(ctx, log, "scenario.updated", "id", "sc_1")

	out := buf.buf.String()
	if !strings.Contains(out, "audit.scenario.updated") {
		t.Errorf("event not emitted, got: %s", out)
	}
	if !strings.Contains(out, "user-42") {
		t.Errorf("actor not present, got: %s", out)
	}
	if !strings.Contains(out, "sc_1") {
		t.Errorf("attrs not present, got: %s", out)
	}
}

func TestEmit_NilLogger(t *testing.T) {
	// Не должно паниковать, если логгер не задан.
	Emit(context.Background(), nil, "scenario.updated", "id", "sc_1")
	Emit(WithActor(context.Background(), "u"), nil, "scenario.deleted", "id", "x")
}

func TestWithActor_EmptyKeepsCtx(t *testing.T) {
	ctx := context.Background()
	got := WithActor(ctx, "")
	if Actor(got) != "" {
		t.Errorf("expected empty actor, got %q", Actor(got))
	}
}

func TestActor_Absent(t *testing.T) {
	if Actor(context.Background()) != "" {
		t.Error("expected empty actor for context without actor")
	}
}
