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
	engine.LoadScenario("sess-1", scenario)

	engine.CheckTriggers(context.Background(), "sess-1", 100, nil, sim, nil, nil)
	if len(sim.Faults) != 0 {
		t.Fatal("should not fire before time")
	}

	fired := engine.CheckTriggers(context.Background(), "sess-1", 120, nil, sim, nil, nil)
	if len(sim.Faults) != 1 {
		t.Fatalf("expected 1 fault, got %d", len(sim.Faults))
	}
	if sim.Faults[0].FaultID != "FLT-K1-PRESSURE-HIGH" {
		t.Errorf("expected FLT-K1-PRESSURE-HIGH (mapped), got %s", sim.Faults[0].FaultID)
	}
	if len(fired) != 1 || fired[0].FaultID != "FLT-K1-PRESSURE-HIGH" {
		t.Fatalf("fired=%+v", fired)
	}

	engine.CheckTriggers(context.Background(), "sess-1", 130, nil, sim, nil, nil)
	if len(sim.Faults) != 1 {
		t.Error("should not fire twice")
	}
}

func TestTriggerEngine_PassesRampSeconds(t *testing.T) {
	engine := testTriggerEngine()
	sim := client.NewMockSimClient()
	t10 := float64(10)
	engine.scenarios["sess-1"] = ScenarioData{
		Faults: []ScenarioFaultData{
			{ID: "f1", FaultID: "FLT-K1-PRESSURE-HIGH", ComponentInstanceID: "column-k1",
				Params:  FaultParamsData{SeverityPct: 100, RampSeconds: 30},
				Trigger: TriggerData{Type: "time", AtModelTime: &t10}},
		},
	}
	engine.CheckTriggers(context.Background(), "sess-1", 10, nil, sim, nil, nil)
	if len(sim.Faults) != 1 {
		t.Fatalf("expected 1 fault, got %d", len(sim.Faults))
	}
	if sim.Faults[0].RampSeconds != 30 {
		t.Fatalf("expected RampSeconds=30, got %v", sim.Faults[0].RampSeconds)
	}
	if sim.Faults[0].SeverityPct != 100 {
		t.Fatalf("expected SeverityPct=100, got %v", sim.Faults[0].SeverityPct)
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
	engine.LoadScenario("sess-1", scenario)

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
	engine.LoadScenario("sess-1", scenario)

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
	engine.LoadScenario("sess-1", scenario)
	engine.CheckTriggers(context.Background(), "sess-1", 50, nil, sim, nil, nil)
	if len(sim.Faults) != 1 {
		t.Fatal("expected 1 fault")
	}

	engine.Reset("sess-1")
	engine.mu.Lock()
	_, exists := engine.scenarios["sess-1"]
	engine.mu.Unlock()
	if exists {
		t.Fatal("scenario should be removed after reset")
	}
}

func TestMapSimFaultID(t *testing.T) {
	if got := MapSimFaultID("pressure_rise_K1"); got != "FLT-K1-PRESSURE-HIGH" {
		t.Fatalf("got %s", got)
	}
	if got := MapSimFaultID("FLT-K1-PRESSURE-HIGH"); got != "FLT-K1-PRESSURE-HIGH" {
		t.Fatalf("passthrough got %s", got)
	}
}

func TestTriggerEngine_ConditionTagHyphenOrSpace(t *testing.T) {
	engine := testTriggerEngine()
	sim := client.NewMockSimClient()
	_ = sim.CreateSession(context.Background(), "sess-1", nil, 0)
	engine.LoadScenario("sess-1", ScenarioData{
		Faults: []ScenarioFaultData{
			{ID: "f1", FaultID: "FLT-K1-LEVEL-LOW", ComponentInstanceID: "column-k1",
				Trigger: TriggerData{Type: "condition", Condition: &ConditionData{
					Tag: "LRCA-602", Op: "<", Value: 30,
				}}},
		},
	})
	tags := []domain.Tag{{TagID: "LRCA 602", Value: 25}}
	fired := engine.CheckTriggers(context.Background(), "sess-1", 10, tags, sim, nil, nil)
	if len(fired) != 1 {
		t.Fatalf("expected hyphen condition to match space tag, fired=%d", len(fired))
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
