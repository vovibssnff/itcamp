package service

import (
	"testing"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
)

func testComponentLookup() func(string) (domain.ComponentType, bool) {
	components := map[string]domain.ComponentType{
		"source": {
			ID: "source", ModelCode: "source",
			Ports: []domain.Port{
				{ID: "outlet", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
			},
		},
		"sink": {
			ID: "sink", ModelCode: "sink",
			Ports: []domain.Port{
				{ID: "inlet", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
			},
		},
		"pump": {
			ID: "pump", ModelCode: "centrifugal_pump",
			Ports: []domain.Port{
				{ID: "inlet", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
				{ID: "outlet", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
			},
		},
		"gas_source": {
			ID: "gas_source", ModelCode: "source",
			Ports: []domain.Port{
				{ID: "outlet", Type: domain.PortGas, Direction: domain.PortOut, Required: true},
			},
		},
	}
	return func(id string) (domain.ComponentType, bool) {
		c, ok := components[id]
		return c, ok
	}
}

func validGraph() domain.Graph {
	return domain.Graph{
		SchemaVersion: "2.0",
		Nodes: []domain.Node{
			{ID: "src", ComponentTypeID: "source"},
			{ID: "pmp", ComponentTypeID: "pump"},
			{ID: "snk", ComponentTypeID: "sink"},
		},
		Edges: []domain.Edge{
			{ID: "e1", Type: domain.PortLiquid, From: edgeEP("src", "outlet"), To: edgeEP("pmp", "inlet")},
			{ID: "e2", Type: domain.PortLiquid, From: edgeEP("pmp", "outlet"), To: edgeEP("snk", "inlet")},
		},
	}
}

func edgeEP(nodeID, port string) domain.EdgeEndpoint {
	return domain.EdgeEndpoint{NodeID: nodeID, Port: port}
}

func TestValidator_ValidGraph(t *testing.T) {
	v := NewValidator(testComponentLookup())
	result := v.Validate(validGraph())
	if !result.Valid {
		t.Errorf("expected valid graph, got errors: %+v", result.Errors)
	}
}

func TestValidator_EmptyGraph(t *testing.T) {
	v := NewValidator(testComponentLookup())
	result := v.Validate(domain.Graph{})
	if result.Valid {
		t.Fatal("expected invalid for empty graph")
	}
	if result.Errors[0].Code != "EMPTY_GRAPH" {
		t.Errorf("expected EMPTY_GRAPH, got %s", result.Errors[0].Code)
	}
}

func TestValidator_PortTypeMismatch(t *testing.T) {
	v := NewValidator(testComponentLookup())
	g := validGraph()
	g.Nodes[0].ComponentTypeID = "gas_source"
	g.Edges[0].Type = domain.PortGas
	result := v.Validate(g)
	if result.Valid {
		t.Fatal("expected invalid for port type mismatch")
	}
	found := false
	for _, e := range result.Errors {
		if e.Code == "PORT_TYPE_MISMATCH" {
			found = true
		}
	}
	if !found {
		t.Error("expected PORT_TYPE_MISMATCH error")
	}
}

func TestValidator_PortDirection_OutToOut(t *testing.T) {
	v := NewValidator(testComponentLookup())
	g := validGraph()
	g.Edges[1].To = edgeEP("pmp", "outlet")
	result := v.Validate(g)
	if result.Valid {
		t.Fatal("expected invalid for out→out connection")
	}
	found := false
	for _, e := range result.Errors {
		if e.Code == "PORT_DIRECTION" {
			found = true
		}
	}
	if !found {
		t.Error("expected PORT_DIRECTION error")
	}
}

func TestValidator_DanglingRequiredPort(t *testing.T) {
	v := NewValidator(testComponentLookup())
	g := validGraph()
	g.Edges = g.Edges[:1]
	result := v.Validate(g)
	if result.Valid {
		t.Fatal("expected invalid for dangling required port")
	}
	found := false
	for _, e := range result.Errors {
		if e.Code == "DANGLING_REQUIRED_PORT" {
			found = true
		}
	}
	if !found {
		t.Error("expected DANGLING_REQUIRED_PORT error")
	}
}

func TestValidator_NoSource(t *testing.T) {
	v := NewValidator(testComponentLookup())
	g := domain.Graph{
		Nodes: []domain.Node{
			{ID: "pmp", ComponentTypeID: "pump"},
			{ID: "snk", ComponentTypeID: "sink"},
		},
		Edges: []domain.Edge{
			{ID: "e1", Type: domain.PortLiquid, From: edgeEP("pmp", "outlet"), To: edgeEP("snk", "inlet")},
		},
	}
	result := v.Validate(g)
	if result.Valid {
		t.Fatal("expected invalid for no source")
	}
	found := false
	for _, e := range result.Errors {
		if e.Code == "NO_SOURCE" {
			found = true
		}
	}
	if !found {
		t.Error("expected NO_SOURCE error")
	}
}

func TestValidator_NoSink(t *testing.T) {
	v := NewValidator(testComponentLookup())
	g := domain.Graph{
		Nodes: []domain.Node{
			{ID: "src", ComponentTypeID: "source"},
			{ID: "pmp", ComponentTypeID: "pump"},
		},
		Edges: []domain.Edge{
			{ID: "e1", Type: domain.PortLiquid, From: edgeEP("src", "outlet"), To: edgeEP("pmp", "inlet")},
		},
	}
	result := v.Validate(g)
	if result.Valid {
		t.Fatal("expected invalid for no sink")
	}
	found := false
	for _, e := range result.Errors {
		if e.Code == "NO_SINK" {
			found = true
		}
	}
	if !found {
		t.Error("expected NO_SINK error")
	}
}

func TestValidator_DisconnectedGraph(t *testing.T) {
	v := NewValidator(testComponentLookup())
	g := domain.Graph{
		Nodes: []domain.Node{
			{ID: "src", ComponentTypeID: "source"},
			{ID: "pmp", ComponentTypeID: "pump"},
			{ID: "snk", ComponentTypeID: "sink"},
			{ID: "iso", ComponentTypeID: "pump"},
		},
		Edges: []domain.Edge{
			{ID: "e1", Type: domain.PortLiquid, From: edgeEP("src", "outlet"), To: edgeEP("pmp", "inlet")},
			{ID: "e2", Type: domain.PortLiquid, From: edgeEP("pmp", "outlet"), To: edgeEP("snk", "inlet")},
		},
	}
	result := v.Validate(g)
	if result.Valid {
		t.Fatal("expected invalid for disconnected graph")
	}
	found := false
	for _, e := range result.Errors {
		if e.Code == "NOT_CONNECTED" {
			found = true
		}
	}
	if !found {
		t.Error("expected NOT_CONNECTED error")
	}
}

func TestValidator_DuplicateNodeID(t *testing.T) {
	v := NewValidator(testComponentLookup())
	g := validGraph()
	g.Nodes = append(g.Nodes, domain.Node{ID: "pmp", ComponentTypeID: "pump"})
	result := v.Validate(g)
	if result.Valid {
		t.Fatal("expected invalid for duplicate node ID")
	}
	found := false
	for _, e := range result.Errors {
		if e.Code == "DUPLICATE_NODE" {
			found = true
		}
	}
	if !found {
		t.Error("expected DUPLICATE_NODE error")
	}
}

func TestValidator_UnknownComponentType(t *testing.T) {
	v := NewValidator(testComponentLookup())
	g := validGraph()
	g.Nodes[1].ComponentTypeID = "nonexistent"
	result := v.Validate(g)
	if result.Valid {
		t.Fatal("expected invalid for unknown component type")
	}
	found := false
	for _, e := range result.Errors {
		if e.Code == "UNKNOWN_COMPONENT_TYPE" {
			found = true
		}
	}
	if !found {
		t.Error("expected UNKNOWN_COMPONENT_TYPE error")
	}
}

func TestValidator_DanglingEdge(t *testing.T) {
	v := NewValidator(testComponentLookup())
	g := validGraph()
	g.Edges[1].To.NodeID = "nonexistent"
	result := v.Validate(g)
	if result.Valid {
		t.Fatal("expected invalid for dangling edge")
	}
	found := false
	for _, e := range result.Errors {
		if e.Code == "DANGLING_EDGE" {
			found = true
		}
	}
	if !found {
		t.Error("expected DANGLING_EDGE error")
	}
}
