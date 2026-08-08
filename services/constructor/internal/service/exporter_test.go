package service

import (
	"testing"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
)

func TestExporter_ValidGraph(t *testing.T) {
	e := NewExporter(testComponentLookup())
	g := validGraph()
	g.Nodes[1].Parameters = map[string]any{"Q_nom": float64(560)}

	state, err := e.Export(g)
	if err != nil {
		t.Fatalf("export failed: %v", err)
	}

	if state["schema_version"] != "2.0" {
		t.Errorf("expected schema_version 2.0, got %v", state["schema_version"])
	}
	if state["model_time"] != float64(0) {
		t.Errorf("expected model_time 0, got %v", state["model_time"])
	}

	nodes, ok := state["nodes"].([]map[string]any)
	if !ok || len(nodes) != 3 {
		t.Fatalf("expected 3 nodes, got %v", state["nodes"])
	}

	pumpNode := nodes[1]
	if pumpNode["model_code"] != "centrifugal_pump" {
		t.Errorf("expected model_code centrifugal_pump, got %v", pumpNode["model_code"])
	}
	params := pumpNode["parameters"].(map[string]any)
	if params["Q_nom"] != float64(560) {
		t.Errorf("expected Q_nom=560, got %v", params["Q_nom"])
	}

	st := pumpNode["state"].(map[string]any)
	if st["running"] != false {
		t.Errorf("expected running=false, got %v", st["running"])
	}
}

func TestExporter_DefaultParameters(t *testing.T) {
	lookup := func(id string) (domain.ComponentType, bool) {
		return domain.ComponentType{
			ID:        "pump",
			ModelCode: "centrifugal_pump",
			Parameters: []domain.Parameter{
				{ID: "Q_nom", Default: float64(450)},
				{ID: "P_max", Default: float64(20)},
			},
		}, true
	}
	e := NewExporter(lookup)
	g := domain.Graph{
		Nodes: []domain.Node{
			{ID: "src", ComponentTypeID: "source"},
			{ID: "pmp", ComponentTypeID: "pump", Parameters: map[string]any{}},
			{ID: "snk", ComponentTypeID: "sink"},
		},
		Edges: []domain.Edge{
			{ID: "e1", Type: domain.PortLiquid, From: edgeEP("src", "outlet"), To: edgeEP("pmp", "inlet")},
			{ID: "e2", Type: domain.PortLiquid, From: edgeEP("pmp", "outlet"), To: edgeEP("snk", "inlet")},
		},
	}

	state, err := e.Export(g)
	if err != nil {
		t.Fatalf("export failed: %v", err)
	}
	nodes := state["nodes"].([]map[string]any)
	params := nodes[1]["parameters"].(map[string]any)
	if params["Q_nom"] != float64(450) {
		t.Errorf("expected default Q_nom=450, got %v", params["Q_nom"])
	}
	if params["P_max"] != float64(20) {
		t.Errorf("expected default P_max=20, got %v", params["P_max"])
	}
}

func TestExporter_EmptyGraph(t *testing.T) {
	e := NewExporter(testComponentLookup())
	_, err := e.Export(domain.Graph{})
	if err == nil {
		t.Fatal("expected error for empty graph")
	}
}

func TestExporter_UnknownComponentType(t *testing.T) {
	e := NewExporter(testComponentLookup())
	g := validGraph()
	g.Nodes[1].ComponentTypeID = "nonexistent"
	_, err := e.Export(g)
	if err == nil {
		t.Fatal("expected error for unknown component type")
	}
}

func TestExporter_ConnectionsFormat(t *testing.T) {
	e := NewExporter(testComponentLookup())
	state, err := e.Export(validGraph())
	if err != nil {
		t.Fatalf("export failed: %v", err)
	}
	conns := state["connections"].([]map[string]any)
	if len(conns) != 2 {
		t.Fatalf("expected 2 connections, got %d", len(conns))
	}
	if conns[0]["from"] != "src:outlet" {
		t.Errorf("expected from 'src:outlet', got %v", conns[0]["from"])
	}
	if conns[0]["to"] != "pmp:inlet" {
		t.Errorf("expected to 'pmp:inlet', got %v", conns[0]["to"])
	}
}

func TestExporter_InitState_Types(t *testing.T) {
	cases := []struct {
		modelCode string
		stateKey  string
	}{
		{"centrifugal_pump", "running"},
		{"heat_exchanger", "Q"},
		{"distillation_column", "T_top"},
		{"furnace", "firing"},
		{"vessel", "level"},
		{"valve", "open"},
		{"pid_controller", "mode"},
		{"source", "active"},
		{"sink", "active"},
	}
	e := NewExporter(testComponentLookup())
	for _, tc := range cases {
		ct := domain.ComponentType{ID: "test", ModelCode: tc.modelCode}
		state := e.initState(ct)
		if _, ok := state[tc.stateKey]; !ok {
			t.Errorf("initState(%s): expected key %q", tc.modelCode, tc.stateKey)
		}
	}
}
