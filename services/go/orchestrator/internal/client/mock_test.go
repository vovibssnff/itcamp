package client

import (
	"context"
	"strings"
	"testing"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

func TestMockSimClient_EmitsElouTags(t *testing.T) {
	m := NewMockSimClient()
	ctx := context.Background()
	if err := m.CreateSession(ctx, "s1", nil, 0); err != nil {
		t.Fatal(err)
	}
	st, err := m.Step(ctx, "s1", 1)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"PRSA 204", "LRCA 602", "PRA 312", "TR 55-9"}
	got := map[string]bool{}
	for _, tag := range st.Tags {
		got[tag.TagID] = true
		if strings.Contains(tag.TagID, "TIC-101") || strings.HasSuffix(tag.TagID, ".PV") {
			t.Fatalf("legacy mock tag still present: %s", tag.TagID)
		}
	}
	for _, id := range want {
		if !got[id] {
			t.Fatalf("missing tag %q", id)
		}
	}
}

func TestMockSimClient_SetActuatorOverridesTag(t *testing.T) {
	m := NewMockSimClient()
	ctx := context.Background()
	_ = m.CreateSession(ctx, "s1", nil, 0)
	if err := m.SetActuator(ctx, "s1", "LRCA 602", 33.5); err != nil {
		t.Fatal(err)
	}
	st, err := m.Step(ctx, "s1", 1)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, tag := range st.Tags {
		if tag.TagID == "LRCA 602" {
			found = true
			if tag.Value != 33.5 {
				t.Fatalf("LRCA 602=%v want 33.5", tag.Value)
			}
		}
	}
	if !found {
		t.Fatal("LRCA 602 missing")
	}
	if len(m.Actuators) == 0 {
		t.Fatal("expected actuator log")
	}
}

func TestMockSimClient_InjectFaultAppliesBias(t *testing.T) {
	m := NewMockSimClient()
	ctx := context.Background()
	_ = m.CreateSession(ctx, "s1", nil, 0)
	before, _ := m.Step(ctx, "s1", 1)
	var beforeP float64
	for _, tag := range before.Tags {
		if tag.TagID == "PRSA 204" {
			beforeP = tag.Value
		}
	}
	if err := m.InjectFault(ctx, domain.InjectFaultReq{
		SessionID: "s1", FaultID: "FLT-K1-PRESSURE-HIGH", SeverityPct: 100,
	}); err != nil {
		t.Fatal(err)
	}
	after, _ := m.Step(ctx, "s1", 1)
	var afterP float64
	for _, tag := range after.Tags {
		if tag.TagID == "PRSA 204" {
			afterP = tag.Value
		}
	}
	if afterP <= beforeP {
		t.Fatalf("expected pressure rise after fault: before=%v after=%v", beforeP, afterP)
	}
}
