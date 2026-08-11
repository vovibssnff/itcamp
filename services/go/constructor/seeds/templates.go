package seeds

import "github.com/itcamp/ktc/services/constructor/internal/domain"

// DemoTemplates returns the pre-built installation templates for the ЭЛОУ-АВТ unit.
// The graph represents the atmospheric crude distillation block:
//
//	ЭЛОУ block → heat-exchange train → furnaces P-1/P-2/P-3 → atmospheric column K-1/K-2
//	→ side strippers K-3/1…K-3/4 → stabilisation column K-4
//
// Node IDs match the ComponentInstanceIDs used in scenario seeds so that fault
// injection can reference concrete node instances.
//
// Tag IDs follow sim-engine template_atm_demo.json (space form: "PRSA 204",
// discrete equipment: "PUMP-N1") so HMI faceplates and readouts bind to live WS telemetry.
func DemoTemplates() []domain.Template {
	return []domain.Template{
		templateELOUAVT(),
	}
}

func templateELOUAVT() domain.Template {
	return domain.Template{
		ID:          "tmpl-elou-avt",
		Name:        "ЭЛОУ-АВТ",
		Description: "Электрообессоливающая установка + атмосферная вакуумная трубчатка (основной блок). Демонстрационный шаблон для тренировочных и экзаменационных сценариев.",
		AuthorID:    "system",
		Status:      domain.StatusPublished,
		Graph:       graphELOUAVT(),
	}
}

func graphELOUAVT() domain.Graph {
	pos := func(x, y float64) domain.Position { return domain.Position{X: x, Y: y} }
	tags := func(ids ...string) map[string]any {
		arr := make([]any, len(ids))
		for i, id := range ids {
			arr[i] = id
		}
		return map[string]any{"tags": arr}
	}
	merge := func(base map[string]any, extra map[string]any) map[string]any {
		out := make(map[string]any, len(base)+len(extra))
		for k, v := range base {
			out[k] = v
		}
		for k, v := range extra {
			out[k] = v
		}
		return out
	}

	nodes := []domain.Node{
		// ─── ЭЛОУ (left) ─────────────────────────────────────────────────────────
		{
			ID: "elec-dehydrator-1", ComponentTypeID: "electro_dehydrator",
			Label:    "Э-1",
			Position: pos(80, 120),
			Parameters: merge(map[string]any{
				"P_work": 8.0, "T_work": 120.0, "V": 160.0,
				"D": 3400.0, "L": 18850.0,
				"U_top": 4.8, "U_bottom": 4.5, "I_max": 90.0,
				"level_min": 3500.0, "efficiency": 90.0,
			}, tags("LRCA 641", "FRC 404")),
			Ports: map[string]domain.PortConnection{},
		},
		{
			ID: "elec-dehydrator-2", ComponentTypeID: "electro_dehydrator",
			Label:    "Э-2",
			Position: pos(80, 320),
			Parameters: merge(map[string]any{
				"P_work": 8.0, "T_work": 120.0, "V": 160.0,
				"D": 3400.0, "L": 18850.0,
				"U_top": 4.8, "U_bottom": 4.5, "I_max": 90.0,
				"level_min": 3500.0, "efficiency": 90.0,
			}, tags("LRCA 640", "FRC 405")),
			Ports: map[string]domain.PortConnection{},
		},
		{
			ID: "vessel-e15", ComponentTypeID: "vessel",
			Label:    "Е-15",
			Position: pos(280, 220),
			Parameters: merge(map[string]any{
				"V": 80.0, "P_calc": 6.0, "T_calc": 140.0, "D": 3000.0, "H": 9000.0,
			}, tags("PRA 312", "LRCA 605")),
			Ports: map[string]domain.PortConnection{},
		},
		{
			ID: "kip-air-supply", ComponentTypeID: "vessel",
			Label:      "А-6",
			Position:   pos(80, 520),
			Parameters: merge(map[string]any{"V": 16.0, "P_calc": 8.0, "T_calc": 50.0, "D": 600.0, "H": 3000.0}, tags("PRA 700")),
			Ports:      map[string]domain.PortConnection{},
		},

		// ─── Насосы ──────────────────────────────────────────────────────────────
		{
			ID: "pump-n1", ComponentTypeID: "centrifugal_pump",
			Label:    "Н-1",
			Position: pos(460, 120),
			Parameters: merge(map[string]any{
				"Q_nom": 450.0, "P_max": 12.0, "N_kw": 250.0, "rpm": 1500.0,
			}, tags("PUMP-N1", "FYQR 117", "PRA 351")),
			Ports: map[string]domain.PortConnection{},
		},
		{
			ID: "pump-n20", ComponentTypeID: "centrifugal_pump",
			Label:    "Н-20",
			Position: pos(460, 340),
			Parameters: merge(map[string]any{
				"Q_nom": 350.0, "P_max": 10.0, "N_kw": 160.0, "rpm": 1500.0,
			}, tags("PUMP-N20", "PRA 352")),
			Ports: map[string]domain.PortConnection{},
		},

		// ─── Теплообменники ──────────────────────────────────────────────────────
		{
			ID: "heat-ex-t1", ComponentTypeID: "heat_exchanger",
			Label:      "Т-1",
			Position:   pos(620, 100),
			Parameters: map[string]any{"F": 400.0, "K": 250.0, "D": 800.0, "L": 10500.0, "P_calc": 19.5, "T_calc": 200.0},
			Ports:      map[string]domain.PortConnection{},
		},
		{
			ID: "heat-ex-t2", ComponentTypeID: "heat_exchanger",
			Label:      "Т-2",
			Position:   pos(620, 340),
			Parameters: map[string]any{"F": 350.0, "K": 230.0, "D": 800.0, "L": 9000.0, "P_calc": 19.5, "T_calc": 200.0},
			Ports:      map[string]domain.PortConnection{},
		},
		{
			ID: "heat-ex-t3", ComponentTypeID: "heat_exchanger",
			Label:      "Т-3",
			Position:   pos(780, 220),
			Parameters: merge(map[string]any{"F": 500.0, "K": 270.0, "D": 900.0, "L": 11000.0, "P_calc": 19.5, "T_calc": 250.0}, tags("TR 41-5")),
			Ports:      map[string]domain.PortConnection{},
		},

		// ─── Печи ────────────────────────────────────────────────────────────────
		{
			ID: "furnace-p1", ComponentTypeID: "furnace",
			Label:    "П-1",
			Position: pos(960, 80),
			Parameters: merge(map[string]any{
				"Q_duty": 50.0e6, "COT_max": 365.0, "passes": 4, "P_calc": 40.0, "T_calc": 400.0,
			}, tags("TRC 9", "TR 55-1")),
			Ports: map[string]domain.PortConnection{},
		},
		{
			ID: "furnace-p3", ComponentTypeID: "furnace",
			Label:    "П-3",
			Position: pos(960, 300),
			Parameters: merge(map[string]any{
				"Q_duty": 25.0e6, "COT_max": 340.0, "passes": 2, "P_calc": 30.0, "T_calc": 370.0,
			}, tags("TRC 3", "TR 55-9", "TRC 5")),
			Ports: map[string]domain.PortConnection{},
		},

		// ─── Атмосферные колонны ─────────────────────────────────────────────────
		{
			ID: "column-k1", ComponentTypeID: "distillation_column",
			Label:    "К-1",
			Position: pos(1160, 40),
			Parameters: merge(map[string]any{
				"trays": 21.0, "P_work": 1.5, "T_top": 120.0, "T_bot": 280.0,
				"P_alarm": 4.5, "P_trip": 4.8,
			}, tags("PRSA 204", "LRCA 602", "TRC 2")),
			Ports: map[string]domain.PortConnection{},
		},
		{
			ID: "column-k2", ComponentTypeID: "distillation_column",
			Label:    "К-2",
			Position: pos(1360, 40),
			Parameters: merge(map[string]any{
				"trays": 42.0, "P_work": 0.15, "T_top": 148.0, "T_bot": 350.0,
				"P_alarm": 1.0, "P_trip": 1.5,
			}, tags("PRSA 213", "LRCA 604")),
			Ports: map[string]domain.PortConnection{},
		},

		// ─── Стриппинги ──────────────────────────────────────────────────────────
		{
			ID: "stripping-k3-1", ComponentTypeID: "stripping_column",
			Label:      "К-3/1",
			Position:   pos(1560, 20),
			Parameters: merge(map[string]any{"trays": 6.0, "P_work": 0.2, "steam_flow": 1500.0}, tags("LRCA 606")),
			Ports:      map[string]domain.PortConnection{},
		},
		{
			ID: "stripping-k3-2", ComponentTypeID: "stripping_column",
			Label:      "К-3/2",
			Position:   pos(1560, 180),
			Parameters: map[string]any{"trays": 6.0, "P_work": 0.2, "steam_flow": 1200.0},
			Ports:      map[string]domain.PortConnection{},
		},
		{
			ID: "stripping-k3-3", ComponentTypeID: "stripping_column",
			Label:      "К-3/3",
			Position:   pos(1560, 340),
			Parameters: map[string]any{"trays": 6.0, "P_work": 0.2, "steam_flow": 1000.0},
			Ports:      map[string]domain.PortConnection{},
		},

		// ─── Колонна стабилизации ─────────────────────────────────────────────────
		{
			ID: "stabilization-k4", ComponentTypeID: "stabilization_column",
			Label:    "К-4",
			Position: pos(1760, 100),
			Parameters: merge(map[string]any{
				"trays": 42.0, "P_work_min": 6.0, "P_work_max": 11.0,
				"T_top": 80.0, "T_bot": 200.0,
			}, tags("PRCA 220")),
			Ports: map[string]domain.PortConnection{},
		},

		// ─── Рефлюксные ёмкости ──────────────────────────────────────────────────
		{
			ID: "vessel-e1", ComponentTypeID: "vessel",
			Label:      "Е-1",
			Position:   pos(1160, 300),
			Parameters: merge(map[string]any{"V": 50.0, "P_calc": 4.0, "T_calc": 150.0, "D": 2000.0, "H": 8000.0}, tags("LRCSA 603")),
			Ports:      map[string]domain.PortConnection{},
		},
		{
			ID: "vessel-e2", ComponentTypeID: "vessel",
			Label:      "Е-2",
			Position:   pos(1360, 300),
			Parameters: merge(map[string]any{"V": 80.0, "P_calc": 1.2, "T_calc": 170.0, "D": 2400.0, "H": 8000.0}, tags("LRCA 604")),
			Ports:      map[string]domain.PortConnection{},
		},

		// ─── АВЗ (воздушные холодильники) ────────────────────────────────────────
		{
			ID: "air-cooler-avz3", ComponentTypeID: "air_cooler",
			Label:      "АВЗ-3",
			Position:   pos(1160, 460),
			Parameters: merge(map[string]any{"F": 3000.0, "fans": 4.0, "T_out_design": 40.0}, tags("AVZ3_SPEED")),
			Ports:      map[string]domain.PortConnection{},
		},
		{
			ID: "air-cooler-avz4", ComponentTypeID: "air_cooler",
			Label:      "АВЗ-4",
			Position:   pos(1360, 460),
			Parameters: merge(map[string]any{"F": 2500.0, "fans": 4.0, "T_out_design": 40.0}, tags("AVZ45_SPEED")),
			Ports:      map[string]domain.PortConnection{},
		},

		// ─── Насосы рефлюкса / откачки ───────────────────────────────────────────
		{
			ID: "pump-n2", ComponentTypeID: "centrifugal_pump",
			Label:      "Н-2",
			Position:   pos(1040, 400),
			Parameters: merge(map[string]any{"Q_nom": 300.0, "P_max": 8.0, "N_kw": 90.0, "rpm": 1500.0}, tags("PUMP-N2")),
			Ports:      map[string]domain.PortConnection{},
		},
		{
			ID: "pump-n6", ComponentTypeID: "centrifugal_pump",
			Label:      "Н-6",
			Position:   pos(1040, 500),
			Parameters: merge(map[string]any{"Q_nom": 200.0, "P_max": 6.0, "N_kw": 55.0, "rpm": 1500.0}, tags("PUMP-N6", "FRC 408")),
			Ports:      map[string]domain.PortConnection{},
		},
		{
			ID: "pump-n3", ComponentTypeID: "centrifugal_pump",
			Label:      "Н-3",
			Position:   pos(1280, 400),
			Parameters: merge(map[string]any{"Q_nom": 540.0, "P_max": 22.0, "N_kw": 400.0, "rpm": 1500.0}, tags("PUMP-N3")),
			Ports:      map[string]domain.PortConnection{},
		},
		{
			ID: "pump-n4", ComponentTypeID: "centrifugal_pump",
			Label:      "Н-4",
			Position:   pos(1660, 420),
			Parameters: merge(map[string]any{"Q_nom": 560.0, "P_max": 20.0, "N_kw": 400.0, "rpm": 1500.0}, tags("PUMP-N4")),
			Ports:      map[string]domain.PortConnection{},
		},

		// ─── ПИД-регуляторы ──────────────────────────────────────────────────────
		{
			ID: "pid-trc2", ComponentTypeID: "pid_controller",
			Label:      "TRC-2",
			Position:   pos(1080, 260),
			Parameters: merge(map[string]any{"Kp": 1.5, "Ki": 0.04, "Kd": 0.0, "out_min": 0.0, "out_max": 100.0}, tags("TRC 2")),
			Ports:      map[string]domain.PortConnection{},
		},
		{
			ID: "pid-trc3", ComponentTypeID: "pid_controller",
			Label:      "TRC-3",
			Position:   pos(880, 440),
			Parameters: merge(map[string]any{"Kp": 2.0, "Ki": 0.05, "Kd": 0.0, "out_min": 0.0, "out_max": 100.0}, tags("TRC 3")),
			Ports:      map[string]domain.PortConnection{},
		},
		{
			ID: "pid-lrca602", ComponentTypeID: "pid_controller",
			Label:      "LRCA-602",
			Position:   pos(1080, 340),
			Parameters: merge(map[string]any{"Kp": 1.2, "Ki": 0.03, "Kd": 0.0, "out_min": 0.0, "out_max": 100.0}, tags("LRCA 602")),
			Ports:      map[string]domain.PortConnection{},
		},

		// ─── КИП-датчики ─────────────────────────────────────────────────────────
		{
			ID: "sensor-pra312", ComponentTypeID: "kip_sensor",
			Label:      "PRA-312",
			Position:   pos(280, 120),
			Parameters: merge(map[string]any{"sensor_type": "P", "range_min": 0.0, "range_max": 20.0, "error_pct": 0.5}, tags("PRA 312")),
			Ports:      map[string]domain.PortConnection{},
		},
		{
			ID: "sensor-ti101", ComponentTypeID: "kip_sensor",
			Label:      "TR-41-5",
			Position:   pos(780, 100),
			Parameters: merge(map[string]any{"sensor_type": "T", "range_min": 0.0, "range_max": 200.0, "error_pct": 0.5}, tags("TR 41-5")),
			Ports:      map[string]domain.PortConnection{},
		},
		{
			ID: "sensor-prsa204", ComponentTypeID: "kip_sensor",
			Label:      "PRSA-204",
			Position:   pos(1160, -20),
			Parameters: merge(map[string]any{"sensor_type": "P", "range_min": 0.0, "range_max": 6.0, "error_pct": 0.25}, tags("PRSA 204")),
			Ports:      map[string]domain.PortConnection{},
		},
	}

	edges := []domain.Edge{
		// ЭЛОУ → Е-15
		{ID: "e-ed1-e15", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "elec-dehydrator-1", Port: "oil_out"},
			To:   domain.EdgeEndpoint{NodeID: "vessel-e15", Port: "inlet"}},
		{ID: "e-ed2-e15", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "elec-dehydrator-2", Port: "oil_out"},
			To:   domain.EdgeEndpoint{NodeID: "vessel-e15", Port: "inlet"}},
		// Е-15 → Н-20 → теплообменники
		{ID: "e-e15-n20", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "vessel-e15", Port: "outlet"},
			To:   domain.EdgeEndpoint{NodeID: "pump-n20", Port: "inlet"}},
		{ID: "e-n20-t2", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "pump-n20", Port: "outlet"},
			To:   domain.EdgeEndpoint{NodeID: "heat-ex-t2", Port: "tube_in"}},
		// Н-1 → теплообменник Т-1
		{ID: "e-ed1-n1", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "elec-dehydrator-1", Port: "oil_out"},
			To:   domain.EdgeEndpoint{NodeID: "pump-n1", Port: "inlet"}},
		{ID: "e-n1-t1", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "pump-n1", Port: "outlet"},
			To:   domain.EdgeEndpoint{NodeID: "heat-ex-t1", Port: "tube_in"}},
		// Теплообменники → Т-3
		{ID: "e-t1-t3", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "heat-ex-t1", Port: "tube_out"},
			To:   domain.EdgeEndpoint{NodeID: "heat-ex-t3", Port: "tube_in"}},
		{ID: "e-t2-t3", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "heat-ex-t2", Port: "tube_out"},
			To:   domain.EdgeEndpoint{NodeID: "heat-ex-t3", Port: "tube_in"}},
		// Т-3 → Печи
		{ID: "e-t3-p1", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "heat-ex-t3", Port: "tube_out"},
			To:   domain.EdgeEndpoint{NodeID: "furnace-p1", Port: "inlet"}},
		{ID: "e-t3-p3", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "heat-ex-t3", Port: "tube_out"},
			To:   domain.EdgeEndpoint{NodeID: "furnace-p3", Port: "inlet"}},
		// Печи → Колонны К-1/К-2
		{ID: "e-p1-k1", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "furnace-p1", Port: "outlet"},
			To:   domain.EdgeEndpoint{NodeID: "column-k1", Port: "inlet"}},
		{ID: "e-p3-k2", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "furnace-p3", Port: "outlet"},
			To:   domain.EdgeEndpoint{NodeID: "column-k2", Port: "inlet"}},
		// К-1 верх → Е-1 / АВЗ-3
		{ID: "e-k1-e1", Type: domain.PortGas,
			From: domain.EdgeEndpoint{NodeID: "column-k1", Port: "gas_out"},
			To:   domain.EdgeEndpoint{NodeID: "vessel-e1", Port: "inlet"}},
		{ID: "e-k1-avz3", Type: domain.PortGas,
			From: domain.EdgeEndpoint{NodeID: "column-k1", Port: "gas_out"},
			To:   domain.EdgeEndpoint{NodeID: "air-cooler-avz3", Port: "inlet"}},
		// Е-1 → Н-6 (орошение К-1)
		{ID: "e-e1-n6", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "vessel-e1", Port: "outlet"},
			To:   domain.EdgeEndpoint{NodeID: "pump-n6", Port: "inlet"}},
		{ID: "e-n6-k1", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "pump-n6", Port: "outlet"},
			To:   domain.EdgeEndpoint{NodeID: "column-k1", Port: "reflux"}},
		// К-1 куб → Н-2
		{ID: "e-k1-n2", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "column-k1", Port: "outlet"},
			To:   domain.EdgeEndpoint{NodeID: "pump-n2", Port: "inlet"}},
		// К-2 верх → Е-2 → АВЗ-4 / Н-7 орошение
		{ID: "e-k2-e2", Type: domain.PortGas,
			From: domain.EdgeEndpoint{NodeID: "column-k2", Port: "gas_out"},
			To:   domain.EdgeEndpoint{NodeID: "vessel-e2", Port: "inlet"}},
		{ID: "e-e2-avz4", Type: domain.PortGas,
			From: domain.EdgeEndpoint{NodeID: "vessel-e2", Port: "gas_out"},
			To:   domain.EdgeEndpoint{NodeID: "air-cooler-avz4", Port: "inlet"}},
		{ID: "e-e2-n3", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "vessel-e2", Port: "outlet"},
			To:   domain.EdgeEndpoint{NodeID: "pump-n3", Port: "inlet"}},
		{ID: "e-n3-k2", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "pump-n3", Port: "outlet"},
			To:   domain.EdgeEndpoint{NodeID: "column-k2", Port: "reflux"}},
		// К-2 → стриппинги
		{ID: "e-k2-k31", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "column-k2", Port: "side_1"},
			To:   domain.EdgeEndpoint{NodeID: "stripping-k3-1", Port: "inlet"}},
		{ID: "e-k2-k32", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "column-k2", Port: "side_2"},
			To:   domain.EdgeEndpoint{NodeID: "stripping-k3-2", Port: "inlet"}},
		{ID: "e-k2-k33", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "column-k2", Port: "side_3"},
			To:   domain.EdgeEndpoint{NodeID: "stripping-k3-3", Port: "inlet"}},
		// Стриппинги → откачка Н-4 → К-4
		{ID: "e-k31-n4", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "stripping-k3-1", Port: "outlet"},
			To:   domain.EdgeEndpoint{NodeID: "pump-n4", Port: "inlet"}},
		{ID: "e-n4-k4", Type: domain.PortLiquid,
			From: domain.EdgeEndpoint{NodeID: "pump-n4", Port: "outlet"},
			To:   domain.EdgeEndpoint{NodeID: "stabilization-k4", Port: "inlet"}},
		// Регуляторы → сигналы
		{ID: "e-trc2-k1", Type: domain.PortSignal,
			From: domain.EdgeEndpoint{NodeID: "pid-trc2", Port: "out"},
			To:   domain.EdgeEndpoint{NodeID: "column-k1", Port: "reflux"}},
		{ID: "e-trc3-p3", Type: domain.PortSignal,
			From: domain.EdgeEndpoint{NodeID: "pid-trc3", Port: "out"},
			To:   domain.EdgeEndpoint{NodeID: "furnace-p3", Port: "fuel"}},
		{ID: "e-lrca602-k1", Type: domain.PortSignal,
			From: domain.EdgeEndpoint{NodeID: "pid-lrca602", Port: "out"},
			To:   domain.EdgeEndpoint{NodeID: "column-k1", Port: "bottoms"}},
		// Датчики
		{ID: "e-pra312-e15", Type: domain.PortSignal,
			From: domain.EdgeEndpoint{NodeID: "sensor-pra312", Port: "output"},
			To:   domain.EdgeEndpoint{NodeID: "vessel-e15", Port: "inlet"}},
		{ID: "e-ti-t3", Type: domain.PortSignal,
			From: domain.EdgeEndpoint{NodeID: "sensor-ti101", Port: "output"},
			To:   domain.EdgeEndpoint{NodeID: "heat-ex-t3", Port: "tube_out"}},
		{ID: "e-prsa204-k1", Type: domain.PortSignal,
			From: domain.EdgeEndpoint{NodeID: "sensor-prsa204", Port: "output"},
			To:   domain.EdgeEndpoint{NodeID: "column-k1", Port: "gas_out"}},
		// КИП-воздух → ЭЛОУ (инструментальный воздух)
		{ID: "e-a6-e15", Type: domain.PortGas,
			From: domain.EdgeEndpoint{NodeID: "kip-air-supply", Port: "outlet"},
			To:   domain.EdgeEndpoint{NodeID: "vessel-e15", Port: "inlet"}},
	}

	mnemo := make(map[string]domain.Position, len(nodes))
	for _, n := range nodes {
		mnemo[n.ID] = n.Position
	}

	return domain.Graph{
		SchemaVersion: "2.0",
		Nodes:         nodes,
		Edges:         edges,
		Layout: domain.Layout{
			MnemoPositions: mnemo,
			CustomLabels:   map[string]string{},
		},
	}
}
