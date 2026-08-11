package client

import (
	"context"
	"testing"
)

func TestCanonicalActuatorTag_PumpAliases(t *testing.T) {
	if got := CanonicalActuatorTag("PUMP-N14"); got != "PUMP-N4" {
		t.Fatalf("got %s", got)
	}
	if got := CanonicalActuatorTag("PUMP-N7"); got != "PUMP-N3" {
		t.Fatalf("got %s", got)
	}
	cmd, _ := ResolveActuatorCommand("PUMP-N14", 0)
	if cmd != "STOP" {
		t.Fatalf("got %s", cmd)
	}
}

func TestResolveActuatorCommand_PumpStartStop(t *testing.T) {
	cmd, v := ResolveActuatorCommand("PUMP-N1", 1)
	if cmd != "START" || v != nil {
		t.Fatalf("got %s %v", cmd, v)
	}
	cmd, v = ResolveActuatorCommand("PUMP N20", 0)
	if cmd != "STOP" || v != nil {
		t.Fatalf("got %s %v", cmd, v)
	}
}

func TestResolveActuatorCommand_ValveOpenClose(t *testing.T) {
	cmd, _ := ResolveActuatorCommand("XV-101", 100)
	if cmd != "OPEN" {
		t.Fatalf("got %s", cmd)
	}
	cmd, _ = ResolveActuatorCommand("ZV-12", 0)
	if cmd != "CLOSE" {
		t.Fatalf("got %s", cmd)
	}
}

func TestResolveActuatorCommand_SetSP(t *testing.T) {
	cmd, v := ResolveActuatorCommand("LRCA 602", 42.5)
	if cmd != "SET_SP" || v != 42.5 {
		t.Fatalf("got %s %v", cmd, v)
	}
}

func TestMockSimClient_PumpStartStop(t *testing.T) {
	m := NewMockSimClient()
	ctx := context.Background()
	if err := m.CreateSession(ctx, "s1", nil, 0); err != nil {
		t.Fatal(err)
	}
	if err := m.SetActuator(ctx, "s1", "PUMP-N1", 0); err != nil {
		t.Fatal(err)
	}
	if len(m.Commands) == 0 || m.Commands[len(m.Commands)-1] != "s1:STOP:PUMP-N1=<nil>" {
		t.Fatalf("commands=%v", m.Commands)
	}
	state, err := m.Step(ctx, "s1", 1)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, tag := range state.Tags {
		if tag.TagID == "PUMP-N1" && tag.Value == 0 {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected PUMP-N1=0 in tags %+v", state.Tags)
	}
}
