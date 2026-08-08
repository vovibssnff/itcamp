package service

import (
	"fmt"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
)

type Exporter struct {
	componentLookup func(id string) (domain.ComponentType, bool)
}

func NewExporter(lookup func(string) (domain.ComponentType, bool)) *Exporter {
	return &Exporter{componentLookup: lookup}
}

func (e *Exporter) Export(graph domain.Graph) (map[string]any, error) {
	if len(graph.Nodes) == 0 {
		return nil, domain.ErrInvalidGraph
	}

	nodes := make([]map[string]any, 0, len(graph.Nodes))
	for _, n := range graph.Nodes {
		ct, ok := e.componentLookup(n.ComponentTypeID)
		if !ok {
			return nil, fmt.Errorf("%w: unknown component type %s", domain.ErrExportFailed, n.ComponentTypeID)
		}

		params := make(map[string]any)
		for k, v := range n.Parameters {
			params[k] = v
		}
		for _, p := range ct.Parameters {
			if _, exists := params[p.ID]; !exists && p.Default != nil {
				params[p.ID] = p.Default
			}
		}

		state := e.initState(ct)
		node := map[string]any{
			"instance_id":      n.ID,
			"model_code":       ct.ModelCode,
			"parameters":       params,
			"state":            state,
		}
		nodes = append(nodes, node)
	}

	connections := make([]map[string]any, 0, len(graph.Edges))
	for _, edge := range graph.Edges {
		connections = append(connections, map[string]any{
			"id":   edge.ID,
			"type": string(edge.Type),
			"from": fmt.Sprintf("%s:%s", edge.From.NodeID, edge.From.Port),
			"to":   fmt.Sprintf("%s:%s", edge.To.NodeID, edge.To.Port),
		})
	}

	result := map[string]any{
		"schema_version": "2.0",
		"model_time":     0.0,
		"seed":           0,
		"nodes":          nodes,
		"connections":    connections,
		"regulators":     []any{},
		"alarms":         []any{},
		"tags":           []any{},
	}

	return result, nil
}

func (e *Exporter) initState(ct domain.ComponentType) map[string]any {
	switch ct.ModelCode {
	case "centrifugal_pump":
		return map[string]any{"running": false, "Q": 0.0, "P_out": 0.0}
	case "heat_exchanger":
		return map[string]any{"T_hot_out": 0.0, "T_cold_out": 0.0, "Q": 0.0}
	case "distillation_column":
		return map[string]any{"P": 0.0, "T_top": 0.0, "T_bottom": 0.0, "level": 0.0}
	case "furnace":
		return map[string]any{"T_out": 0.0, "firing": false, "fuel_flow": 0.0}
	case "vessel", "electro_dehydrator":
		return map[string]any{"level": 0.0, "P": 0.0, "T": 0.0}
	case "valve", "gate_valve":
		return map[string]any{"open": 0.0}
	case "pid_controller":
		return map[string]any{"pv": 0.0, "sp": 0.0, "out": 0.0, "mode": "AUTO"}
	case "source", "boundary_source":
		return map[string]any{"active": true}
	case "sink", "boundary_sink":
		return map[string]any{"active": true}
	default:
		return map[string]any{}
	}
}
