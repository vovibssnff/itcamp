package service

import (
	"context"
	"log/slog"
	"os"
	"testing"

	"github.com/itcamp/ktc/services/orchestrator/internal/client"
	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

var testLog = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))

func testTriggerEngine() *TriggerEngine {
	return NewTriggerEngine(testLog)
}

func TestTriggerEngine_TimeTrigger_FiresAtCorrectTime(t *testing.T) {
	engine := testTriggerEngine()
	sim := client.NewMockSimClient()

	t120 := float64(120)
	scenario := ScenarioData{
		Faults: []ScenarioFaultData{
			{ID: "f1", FaultID: "pressure_rise_K1", ComponentInstanceID: "column-k1",
				Params:  FaultParamsData{SeverityPct: 100, RampSeconds: 0},
				Trigger: TriggerData{Type: "time", AtModelTime: &t120}},
		},
	}
	engine.scenarios["sess-1"] = scenario

	engine.CheckTriggers(context.Background(), "sess-1", 100, nil, sim, nil, nil)
	if len(sim.Faults) != 0 {
		t.Fatal("should not fire before time")
	}

	engine.CheckTriggers(context.Background(), "sess-1", 120, nil, sim, nil, nil)
	if len(sim.Faults) != 1 {
		t.Fatalf("expected 1 fault, got %d", len(sim.Faults))
	}
	if sim.Faults[0].FaultID != "pressure_rise_K1" {
		t.Errorf("expected pressure_rise_K1, got %s", sim.Faults[0].FaultID)
	}

	engine.CheckTriggers(context.Background(), "sess-1", 130, nil, sim, nil, nil)
	if len(sim.Faults) != 1 {
		t.Error("should not fire twice")
	}
}

func TestTriggerEngine_ConditionTrigger_FiresWhenThresholdReached(t *testing.T) {
	engine := testTriggerEngine()
	sim := client.NewMockSimClient()

	scenario := ScenarioData{
		Faults: []ScenarioFaultData{
			{ID: "f1", FaultID: "cot_rise_furnace", ComponentInstanceID: "furnace-p3",
				Trigger: TriggerData{Type: "condition", Condition: &ConditionData{
					Tag: "TR-55-9", Op: ">=", Value: 335,
				}}},
		},
	}
	engine.scenarios["sess-1"] = scenario

	tags := []domain.Tag{{TagID: "TR-55-9", Value: 330}}
	engine.CheckTriggers(context.Background(), "sess-1", 50, tags, sim, nil, nil)
	if len(sim.Faults) != 0 {
		t.Fatal("should not fire below threshold")
	}

	tags = []domain.Tag{{TagID: "TR-55-9", Value: 336}}
	engine.CheckTriggers(context.Background(), "sess-1", 55, tags, sim, nil, nil)
	if len(sim.Faults) != 1 {
		t.Fatalf("expected 1 fault, got %d", len(sim.Faults))
	}
}

func TestTriggerEngine_MultipleFaults(t *testing.T) {
	engine := testTriggerEngine()
	sim := client.NewMockSimClient()

	t60 := float64(60)
	t120 := float64(120)
	scenario := ScenarioData{
		Faults: []ScenarioFaultData{
			{ID: "f1", FaultID: "feed_flow_drop", ComponentInstanceID: "pump-n1",
				Trigger: TriggerData{Type: "time", AtModelTime: &t60}},
			{ID: "f2", FaultID: "pressure_rise_K1", ComponentInstanceID: "column-k1",
				Trigger: TriggerData{Type: "time", AtModelTime: &t120}},
		},
	}
	engine.scenarios["sess-1"] = scenario

	engine.CheckTriggers(context.Background(), "sess-1", 60, nil, sim, nil, nil)
	if len(sim.Faults) != 1 {
		t.Fatalf("expected 1 fault at t=60, got %d", len(sim.Faults))
	}

	engine.CheckTriggers(context.Background(), "sess-1", 120, nil, sim, nil, nil)
	if len(sim.Faults) != 2 {
		t.Fatalf("expected 2 faults at t=120, got %d", len(sim.Faults))
	}
}

func TestTriggerEngine_NoScenario(t *testing.T) {
	engine := testTriggerEngine()
	sim := client.NewMockSimClient()
	engine.CheckTriggers(context.Background(), "unknown-session", 100, nil, sim, nil, nil)
	if len(sim.Faults) != 0 {
		t.Fatal("should not fire without scenario")
	}
}

func TestTriggerEngine_Reset(t *testing.T) {
	engine := testTriggerEngine()
	sim := client.NewMockSimClient()

	t50 := float64(50)
	scenario := ScenarioData{
		Faults: []ScenarioFaultData{
			{ID: "f1", FaultID: "test", ComponentInstanceID: "x",
				Trigger: TriggerData{Type: "time", AtModelTime: &t50}},
		},
	}
	engine.scenarios["sess-1"] = scenario
	engine.CheckTriggers(context.Background(), "sess-1", 50, nil, sim, nil, nil)
	if len(sim.Faults) != 1 {
		t.Fatal("expected 1 fault")
	}

	engine.Reset("sess-1")
	if _, exists := engine.scenarios["sess-1"]; exists {
		t.Fatal("scenario should be removed after reset")
	}
}

func TestCheckCondition_AllOps(t *testing.T) {
	cases := []struct {
		op        string
		value     float64
		threshold float64
		expected  bool
	}{
		{">=", 5.0, 5.0, true},
		{">=", 4.9, 5.0, false},
		{"<=", 5.0, 5.0, true},
		{"<=", 5.1, 5.0, false},
		{">", 5.1, 5.0, true},
		{">", 5.0, 5.0, false},
		{"<", 4.9, 5.0, true},
		{"<", 5.0, 5.0, false},
		{"==", 5.0, 5.0, true},
		{"==", 5.1, 5.0, false},
		{"!=", 5.0, 5.0, false},
	}
	for _, tc := range cases {
		result := checkCondition(tc.value, tc.op, tc.threshold)
		if result != tc.expected {
			t.Errorf("checkCondition(%v, %s, %v) = %v, expected %v", tc.value, tc.op, tc.threshold, result, tc.expected)
		}
	}
}

func TestWSHub_RegisterUnregister(t *testing.T) {
	hub := NewWSHub()
	c1 := NewWSClient("operator", "u1")
	c2 := NewWSClient("observer", "u2")

	hub.Register("sess-1", c1)
	hub.Register("sess-1", c2)
	if hub.ClientCount("sess-1") != 2 {
		t.Errorf("expected 2 clients, got %d", hub.ClientCount("sess-1"))
	}

	hub.Unregister("sess-1", c1)
	if hub.ClientCount("sess-1") != 1 {
		t.Errorf("expected 1 client, got %d", hub.ClientCount("sess-1"))
	}

	hub.Unregister("sess-1", c2)
	if hub.ClientCount("sess-1") != 0 {
		t.Errorf("expected 0 clients, got %d", hub.ClientCount("sess-1"))
	}
}

func TestWSHub_BroadcastTelemetry(t *testing.T) {
	hub := NewWSHub()
	c1 := NewWSClient("operator", "u1")
	hub.Register("sess-1", c1)

	hub.BroadcastTelemetry("sess-1", domain.Telemetry{ModelTime: 42.0})

	select {
	case msg := <-c1.SendChan():
		if string(msg) == "" {
			t.Error("expected non-empty message")
		}
	default:
		t.Error("expected to receive message")
	}
}
