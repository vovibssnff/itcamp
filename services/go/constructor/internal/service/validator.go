package service

import (
	"github.com/itcamp/ktc/services/constructor/internal/domain"
)

type Validator struct {
	componentLookup func(id string) (domain.ComponentType, bool)
}

func NewValidator(lookup func(string) (domain.ComponentType, bool)) *Validator {
	return &Validator{componentLookup: lookup}
}

func (v *Validator) Validate(graph domain.Graph) domain.ValidationResult {
	var errs []domain.ValidationError

	if len(graph.Nodes) == 0 {
		return domain.ValidationResult{Valid: false, Errors: []domain.ValidationError{
			{Code: "EMPTY_GRAPH", Message: "граф не содержит узлов"},
		}}
	}

	nodeMap := make(map[string]*domain.Node, len(graph.Nodes))
	for i := range graph.Nodes {
		n := &graph.Nodes[i]
		if _, dup := nodeMap[n.ID]; dup {
			errs = append(errs, domain.ValidationError{
				Code: "DUPLICATE_NODE", Message: "дубликат ID узла", NodeID: n.ID,
			})
			continue
		}
		nodeMap[n.ID] = n
	}

	edgeMap := make(map[string]bool, len(graph.Edges))
	for _, e := range graph.Edges {
		if e.ID == "" {
			errs = append(errs, domain.ValidationError{Code: "EMPTY_EDGE_ID", Message: "ребро без ID"})
			continue
		}
		if edgeMap[e.ID] {
			errs = append(errs, domain.ValidationError{Code: "DUPLICATE_EDGE", Message: "дубликат ID ребра", EdgeID: e.ID})
			continue
		}
		edgeMap[e.ID] = true

		fromNode, fromOK := nodeMap[e.From.NodeID]
		toNode, toOK := nodeMap[e.To.NodeID]
		if !fromOK || !toOK {
			errs = append(errs, domain.ValidationError{
				Code: "DANGLING_EDGE", Message: "ребро ссылается на несуществующий узел", EdgeID: e.ID,
			})
			continue
		}

		fromPort := v.findPort(fromNode.ComponentTypeID, e.From.Port)
		toPort := v.findPort(toNode.ComponentTypeID, e.To.Port)
		if fromPort == nil || toPort == nil {
			errs = append(errs, domain.ValidationError{
				Code: "PORT_NOT_FOUND", Message: "порт не найден в типе компонента", EdgeID: e.ID,
			})
			continue
		}

		if fromPort.Type != toPort.Type {
			errs = append(errs, domain.ValidationError{
				Code: "PORT_TYPE_MISMATCH", Message: "несовпадение типов портов: " + string(fromPort.Type) + " != " + string(toPort.Type), EdgeID: e.ID,
			})
		}

		if fromPort.Direction != domain.PortOut {
			errs = append(errs, domain.ValidationError{
				Code: "PORT_DIRECTION", Message: "источник должен быть выходным портом", EdgeID: e.ID,
			})
		}
		if toPort.Direction != domain.PortIn {
			errs = append(errs, domain.ValidationError{
				Code: "PORT_DIRECTION", Message: "приёмник должен быть входным портом", EdgeID: e.ID,
			})
		}
	}

	for _, n := range graph.Nodes {
		ct, ok := v.componentLookup(n.ComponentTypeID)
		if !ok {
			errs = append(errs, domain.ValidationError{
				Code: "UNKNOWN_COMPONENT_TYPE", Message: "неизвестный тип компонента: " + n.ComponentTypeID, NodeID: n.ID,
			})
			continue
		}
		connectedPorts := v.connectedPorts(graph, n.ID)
		for _, port := range ct.Ports {
			if port.Required && !connectedPorts[port.ID] {
				errs = append(errs, domain.ValidationError{
					Code: "DANGLING_REQUIRED_PORT", Message: "обязательный порт не соединён: " + port.ID, NodeID: n.ID,
				})
			}
		}
	}

	hasSource := v.hasSource(graph)
	hasSink := v.hasSink(graph)
	if !hasSource {
		errs = append(errs, domain.ValidationError{Code: "NO_SOURCE", Message: "нет ни одного источника"})
	}
	if !hasSink {
		errs = append(errs, domain.ValidationError{Code: "NO_SINK", Message: "нет ни одного стока"})
	}

	if !v.isConnected(graph, nodeMap) {
		errs = append(errs, domain.ValidationError{Code: "NOT_CONNECTED", Message: "граф несвязный"})
	}

	return domain.ValidationResult{Valid: len(errs) == 0, Errors: errs}
}

func (v *Validator) findPort(componentTypeID, portID string) *domain.Port {
	ct, ok := v.componentLookup(componentTypeID)
	if !ok {
		return nil
	}
	for i := range ct.Ports {
		if ct.Ports[i].ID == portID {
			return &ct.Ports[i]
		}
	}
	return nil
}

func (v *Validator) connectedPorts(graph domain.Graph, nodeID string) map[string]bool {
	connected := make(map[string]bool)
	for _, e := range graph.Edges {
		if e.From.NodeID == nodeID {
			connected[e.From.Port] = true
		}
		if e.To.NodeID == nodeID {
			connected[e.To.Port] = true
		}
	}
	return connected
}

func (v *Validator) hasSource(graph domain.Graph) bool {
	for _, n := range graph.Nodes {
		ct, ok := v.componentLookup(n.ComponentTypeID)
		if !ok {
			continue
		}
		if ct.ModelCode == "source" || ct.ModelCode == "boundary_source" {
			return true
		}
	}
	return false
}

func (v *Validator) hasSink(graph domain.Graph) bool {
	for _, n := range graph.Nodes {
		ct, ok := v.componentLookup(n.ComponentTypeID)
		if !ok {
			continue
		}
		if ct.ModelCode == "sink" || ct.ModelCode == "boundary_sink" {
			return true
		}
	}
	return false
}

func (v *Validator) isConnected(graph domain.Graph, nodeMap map[string]*domain.Node) bool {
	if len(nodeMap) <= 1 {
		return true
	}
	adj := make(map[string]map[string]bool, len(nodeMap))
	for id := range nodeMap {
		adj[id] = make(map[string]bool)
	}
	for _, e := range graph.Edges {
		if _, ok := adj[e.From.NodeID]; !ok {
			continue
		}
		if _, ok := adj[e.To.NodeID]; !ok {
			continue
		}
		adj[e.From.NodeID][e.To.NodeID] = true
		adj[e.To.NodeID][e.From.NodeID] = true
	}

	visited := make(map[string]bool, len(nodeMap))
	var start string
	for id := range nodeMap {
		start = id
		break
	}
	v.dfs(start, adj, visited)

	return len(visited) == len(nodeMap)
}

func (v *Validator) dfs(node string, adj map[string]map[string]bool, visited map[string]bool) {
	visited[node] = true
	for neighbor := range adj[node] {
		if !visited[neighbor] {
			v.dfs(neighbor, adj, visited)
		}
	}
}
