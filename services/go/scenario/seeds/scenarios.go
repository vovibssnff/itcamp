package seeds

import "github.com/itcamp/ktc/services/scenario/internal/domain"

func pFloat(v float64) *float64 { return &v }

func defaultCriteria() domain.Criteria {
	return domain.Criteria{
		MaxScore: 100, PenaltyLate: 10, PenaltyMiss: 25, PenaltyForbidden: 40,
		CriticalActions: []string{"esd_without_reason", "wrong_paz_override"},
		PassThreshold:   70,
	}
}

func DemoScenarios() []domain.Scenario {
	return []domain.Scenario{
		scenarioLevelDropDehydrator(),
		scenarioPressureRiseDehydrator(),
		scenarioFeedFlowDrop(),
		scenarioCOTRiseFurnace(),
		scenarioPressureRiseK1(),
		scenarioLevelDropK1(),
		scenarioVacuumLossK2(),
		scenarioLevelDropK3_1(),
		scenarioPressureRiseK4(),
		scenarioInstrumentAirLoss(),
	}
}

func scenarioLevelDropDehydrator() domain.Scenario {
	return domain.Scenario{
		ID: "sc-elou-level-drop", TemplateID: "tmpl-elou-avt", Name: "Падение уровня раздела фаз в Э-1",
		Description: "Снижение уровня в электродегидраторе Э-1 → блокировка HV при <3500 мм",
		Type:        domain.ScenarioTraining,
		Faults: []domain.ScenarioFault{
			{ID: "f1", FaultID: "FLT-ELOU-INTERFACE-LOW", ComponentInstanceID: "elec-dehydrator-1",
				Params:  domain.FaultParams{SeverityPct: 100, RampSeconds: 60},
				Trigger: domain.Trigger{Type: domain.TriggerTime, AtModelTime: pFloat(120)}},
		},
		ReferenceActions: []domain.ReferenceAction{
			{Step: 1, Description: "Перевести LRCA-641 в ручной режим, прикрыть клапан сброса воды",
				Expected: domain.ExpectedAction{Target: "LRCA-641", Action: "set_mode", Value: "MANUAL"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 2, Description: "Уменьшить подачу промывочной воды на смесители А-19",
				Expected: domain.ExpectedAction{Target: "FR-495A", Action: "decrease"}, DeadlineSeconds: 60, Mandatory: true},
			{Step: 3, Description: "При уровне <3500 мм — обесточить ИПМ (ESD)",
				Expected: domain.ExpectedAction{Target: "ESD-ELOU", Action: "confirm"}, DeadlineSeconds: 30, Mandatory: true},
		},
		Criteria: defaultCriteria(),
	}
}

func scenarioPressureRiseDehydrator() domain.Scenario {
	return domain.Scenario{
		ID: "sc-elou-pressure-rise", TemplateID: "tmpl-elou-avt", Name: "Рост давления в электродегидраторах / Е-15",
		Description: "Рост давления на выкиде Н-1 и в Е-15",
		Type:        domain.ScenarioTraining,
		Faults: []domain.ScenarioFault{
			{ID: "f1", FaultID: "FLT-ELOU-PRESSURE-HIGH", ComponentInstanceID: "vessel-e15",
				Params: domain.FaultParams{SeverityPct: 80, RampSeconds: 120},
				Trigger: domain.Trigger{Type: domain.TriggerCondition, Condition: &domain.ConditionSpec{
					Tag: "PRA 312", Op: domain.OpGTE, Value: 5.0,
				}}},
		},
		ReferenceActions: []domain.ReferenceAction{
			{Step: 1, Description: "Прикрыть регуляторы расхода FRC-404/405/406",
				Expected: domain.ExpectedAction{Target: "FRC-404", Action: "decrease"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 2, Description: "Проверить клапаны PRC-313 (дренаж воды)",
				Expected: domain.ExpectedAction{Target: "PRC-313", Action: "check"}, DeadlineSeconds: 45, Mandatory: true},
			{Step: 3, Description: "Снизить производительность насосов Н-1",
				Expected: domain.ExpectedAction{Target: "PUMP-N1", Action: "decrease"}, DeadlineSeconds: 60, Mandatory: true},
		},
		Criteria: defaultCriteria(),
	}
}

func scenarioFeedFlowDrop() domain.Scenario {
	return domain.Scenario{
		ID: "sc-feed-flow-drop", TemplateID: "tmpl-elou-avt", Name: "Падение расхода сырой нефти при работающих печах",
		Description: "Снижение расхода нефти → риск перегрева печей",
		Type:        domain.ScenarioTraining,
		Faults: []domain.ScenarioFault{
			{ID: "f1", FaultID: "FLT-FEED-FLOW-LOW", ComponentInstanceID: "pump-n1",
				Params:  domain.FaultParams{SeverityPct: 100, RampSeconds: 0},
				Trigger: domain.Trigger{Type: domain.TriggerTime, AtModelTime: pFloat(60)}},
		},
		ReferenceActions: []domain.ReferenceAction{
			{Step: 1, Description: "Немедленно снизить подачу топлива на печи П-1/П-2/П-3",
				Expected: domain.ExpectedAction{Target: "TRC-9", Action: "decrease"}, DeadlineSeconds: 20, Mandatory: true},
			{Step: 2, Description: "Проверить работу насосов Н-1, давление на выкиде PRA-351",
				Expected: domain.ExpectedAction{Target: "PUMP-N1", Action: "check"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 3, Description: "Переключить на резервный насос (Компакс)",
				Expected: domain.ExpectedAction{Target: "PUMP-N1A", Action: "start"}, DeadlineSeconds: 60, Mandatory: true},
			{Step: 4, Description: "Если поток не восстановлен — аварийный останов печей (ESD-ATM)",
				Expected: domain.ExpectedAction{Target: "ESD-ATM", Action: "confirm"}, DeadlineSeconds: 90, Mandatory: false},
		},
		Criteria: defaultCriteria(),
	}
}

func scenarioCOTRiseFurnace() domain.Scenario {
	return domain.Scenario{
		ID: "sc-cot-rise-p3", TemplateID: "tmpl-elou-avt", Name: "Рост COT печи П-3",
		Description: "Рост температуры змеевика П-3 выше 340°C",
		Type:        domain.ScenarioTraining,
		Faults: []domain.ScenarioFault{
			{ID: "f1", FaultID: "FLT-P3-COT-HIGH", ComponentInstanceID: "furnace-p3",
				Params: domain.FaultParams{SeverityPct: 90, RampSeconds: 90},
				Trigger: domain.Trigger{Type: domain.TriggerCondition, Condition: &domain.ConditionSpec{
					Tag: "TR 55-9", Op: domain.OpGT, Value: 335,
				}}},
		},
		ReferenceActions: []domain.ReferenceAction{
			{Step: 1, Description: "Уменьшить подачу топливного газа через TRC-3 и TRC-5",
				Expected: domain.ExpectedAction{Target: "TRC-3", Action: "decrease"}, DeadlineSeconds: 20, Mandatory: true},
			{Step: 2, Description: "Проверить расходы через П-3: FRCA-416/417/810",
				Expected: domain.ExpectedAction{Target: "FRCA-416", Action: "check"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 3, Description: "Проверить температуру перевалов TR-39-1..6",
				Expected: domain.ExpectedAction{Target: "TR-39-1", Action: "check"}, DeadlineSeconds: 45, Mandatory: false},
			{Step: 4, Description: "При T>340°C — снизить нагрузку, подготовить останов П-3",
				Expected: domain.ExpectedAction{Target: "PRCA-205", Action: "decrease"}, DeadlineSeconds: 60, Mandatory: true},
		},
		Criteria: defaultCriteria(),
	}
}

func scenarioPressureRiseK1() domain.Scenario {
	return domain.Scenario{
		ID: "sc-K1-pressure-rise", TemplateID: "tmpl-elou-avt", Name: "Рост давления в К-1 до блокировки ПАЗ",
		Description: "Рост давления верха К-1 → блокировка при 4,8 кгс/см² (FR-AV-05)",
		Type:        domain.ScenarioExam,
		Faults: []domain.ScenarioFault{
			{ID: "f1", FaultID: "FLT-K1-PRESSURE-HIGH", ComponentInstanceID: "column-k1",
				Params:  domain.FaultParams{SeverityPct: 100, RampSeconds: 120},
				Trigger: domain.Trigger{Type: domain.TriggerTime, AtModelTime: pFloat(180)}},
		},
		ReferenceActions: []domain.ReferenceAction{
			{Step: 1, Description: "Форсировать АВЗ-3 (жалюзи открыты, макс. обороты)",
				Expected: domain.ExpectedAction{Target: "AVZ-3", Action: "max_cooling"}, DeadlineSeconds: 20, Mandatory: true},
			{Step: 2, Description: "Увеличить подачу воды в Х-1/3, Х-1/4, Х-1/5",
				Expected: domain.ExpectedAction{Target: "X-1-3", Action: "increase"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 3, Description: "Увеличить орошение через TRC-2 / FRC-408",
				Expected: domain.ExpectedAction{Target: "TRC-2", Action: "increase"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 4, Description: "Проверить PRC-221 (сброс газа в БКГ)",
				Expected: domain.ExpectedAction{Target: "PRC-221", Action: "check"}, DeadlineSeconds: 45, Mandatory: true},
			{Step: 5, Description: "При P≥4,8 — продублировать блокировку ПАЗ ручным закрытием задвижек печи",
				Expected: domain.ExpectedAction{Target: "ESD-ATM", Action: "confirm"}, DeadlineSeconds: 15, Mandatory: true},
		},
		Criteria: defaultCriteria(),
	}
}

func scenarioLevelDropK1() domain.Scenario {
	return domain.Scenario{
		ID: "sc-K1-level-drop", TemplateID: "tmpl-elou-avt", Name: "Падение уровня в кубе К-1",
		Description: "Падение уровня LRCA-602 → риск сухого хода насосов Н-2/Н-3",
		Type:        domain.ScenarioTraining,
		Faults: []domain.ScenarioFault{
			{ID: "f1", FaultID: "FLT-K1-LEVEL-LOW", ComponentInstanceID: "column-k1",
				Params: domain.FaultParams{SeverityPct: 80, RampSeconds: 90},
				Trigger: domain.Trigger{Type: domain.TriggerCondition, Condition: &domain.ConditionSpec{
					Tag: "LRCA 602", Op: domain.OpLT, Value: 30,
				}}},
		},
		ReferenceActions: []domain.ReferenceAction{
			{Step: 1, Description: "Уменьшить откачку Н-2/Н-3 (FRCA-411..414)",
				Expected: domain.ExpectedAction{Target: "FRCA-411", Action: "decrease"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 2, Description: "Увеличить подачу нефти в К-1 (FRC-458/459/460)",
				Expected: domain.ExpectedAction{Target: "FRC-458", Action: "increase"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 3, Description: "Снизить подачу пара FR-803",
				Expected: domain.ExpectedAction{Target: "FR-803", Action: "decrease"}, DeadlineSeconds: 45, Mandatory: true},
			{Step: 4, Description: "Подготовить насосы Н-2/Н-3 к останову",
				Expected: domain.ExpectedAction{Target: "PUMP-N2", Action: "prepare_stop"}, DeadlineSeconds: 60, Mandatory: false},
		},
		Criteria: defaultCriteria(),
	}
}

func scenarioVacuumLossK2() domain.Scenario {
	return domain.Scenario{
		ID: "sc-K2-vacuum-loss", TemplateID: "tmpl-elou-avt", Name: "Потеря вакуума в К-2",
		Description: "Рост давления в К-2 до 1,0 кгс/см² → ПАЗ при 1,5",
		Type:        domain.ScenarioExam,
		Faults: []domain.ScenarioFault{
			{ID: "f1", FaultID: "FLT-K2-VACUUM-LOSS", ComponentInstanceID: "column-k2",
				Params:  domain.FaultParams{SeverityPct: 100, RampSeconds: 150},
				Trigger: domain.Trigger{Type: domain.TriggerTime, AtModelTime: pFloat(200)}},
		},
		ReferenceActions: []domain.ReferenceAction{
			{Step: 1, Description: "Форсировать АВЗ-4/5 (вентиляторы, жалюзи)",
				Expected: domain.ExpectedAction{Target: "AVZ-4", Action: "max_cooling"}, DeadlineSeconds: 20, Mandatory: true},
			{Step: 2, Description: "Увеличить подачу воды в Х-2/3, Х-2/4, Х-2/5",
				Expected: domain.ExpectedAction{Target: "X-2-3", Action: "increase"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 3, Description: "Проверить орошение FRC-418 / TRC-50",
				Expected: domain.ExpectedAction{Target: "FRC-418", Action: "check"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 4, Description: "Уменьшить расход пара FRC-421",
				Expected: domain.ExpectedAction{Target: "FRC-421", Action: "decrease"}, DeadlineSeconds: 45, Mandatory: true},
			{Step: 5, Description: "При P≥1,5 — ПАЗ: отсечка топлива, пара, Т-1К",
				Expected: domain.ExpectedAction{Target: "ESD-ATM", Action: "confirm"}, DeadlineSeconds: 15, Mandatory: true},
		},
		Criteria: defaultCriteria(),
	}
}

func scenarioLevelDropK3_1() domain.Scenario {
	return domain.Scenario{
		ID: "sc-K3-1-level-drop", TemplateID: "tmpl-elou-avt", Name: "Падение уровня в стриппинге К-3/1",
		Description: "Падение уровня LRCA-606 ниже 15% → останов насосов Н-14/Н-67А",
		Type:        domain.ScenarioTraining,
		Faults: []domain.ScenarioFault{
			{ID: "f1", FaultID: "FLT-K31-LEVEL-LOW", ComponentInstanceID: "stripping-k3-1",
				Params: domain.FaultParams{SeverityPct: 90, RampSeconds: 60},
				Trigger: domain.Trigger{Type: domain.TriggerCondition, Condition: &domain.ConditionSpec{
					Tag: "LRCA 606", Op: domain.OpLT, Value: 20,
				}}},
		},
		ReferenceActions: []domain.ReferenceAction{
			{Step: 1, Description: "Перевести LRCA-606 в ручной, прикрыть клапан Н-14",
				Expected: domain.ExpectedAction{Target: "LRCA-606", Action: "set_mode", Value: "MANUAL"}, DeadlineSeconds: 20, Mandatory: true},
			{Step: 2, Description: "Проверить поступление погона с 35-й тарелки К-2 (TR-17-33)",
				Expected: domain.ExpectedAction{Target: "TR-17-33", Action: "check"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 3, Description: "Отрегулировать подачу пара FRC-422",
				Expected: domain.ExpectedAction{Target: "FRC-422", Action: "adjust"}, DeadlineSeconds: 45, Mandatory: true},
		},
		Criteria: defaultCriteria(),
	}
}

func scenarioPressureRiseK4() domain.Scenario {
	return domain.Scenario{
		ID: "sc-K4-pressure-rise", TemplateID: "tmpl-elou-avt", Name: "Рост давления в колонне стабилизации К-4",
		Description: "Рост давления PRCA-220 выше 11 кгс/см²",
		Type:        domain.ScenarioTraining,
		Faults: []domain.ScenarioFault{
			{ID: "f1", FaultID: "FLT-K4-PRESSURE-HIGH", ComponentInstanceID: "stabilization-k4",
				Params: domain.FaultParams{SeverityPct: 80, RampSeconds: 120},
				Trigger: domain.Trigger{Type: domain.TriggerCondition, Condition: &domain.ConditionSpec{
					Tag: "PRCA 220", Op: domain.OpGT, Value: 11,
				}}},
		},
		ReferenceActions: []domain.ReferenceAction{
			{Step: 1, Description: "Проверить клапан PRCA-220 (выход паров в Х-4)",
				Expected: domain.ExpectedAction{Target: "PRCA-220", Action: "check"}, DeadlineSeconds: 20, Mandatory: true},
			{Step: 2, Description: "Увеличить подачу воды в Х-4/1/2/3",
				Expected: domain.ExpectedAction{Target: "X-4-1", Action: "increase"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 3, Description: "Проверить PRCA-223 (сдувка газа в БКГ)",
				Expected: domain.ExpectedAction{Target: "PRCA-223", Action: "check"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 4, Description: "Снизить подачу тепла в куб К-4 (TRC-5)",
				Expected: domain.ExpectedAction{Target: "TRC-5", Action: "decrease"}, DeadlineSeconds: 45, Mandatory: true},
		},
		Criteria: defaultCriteria(),
	}
}

func scenarioInstrumentAirLoss() domain.Scenario {
	return domain.Scenario{
		ID: "sc-instrument-air-loss", TemplateID: "tmpl-elou-avt", Name: "Падение давления воздуха КИП",
		Description: "Падение давления PRA-700 → отказ регуляторов → аварийный останов",
		Type:        domain.ScenarioExam,
		Faults: []domain.ScenarioFault{
			{ID: "f1", FaultID: "FLT-IA-PRESSURE-LOW", ComponentInstanceID: "kip-air-supply",
				Params:  domain.FaultParams{SeverityPct: 100, RampSeconds: 0},
				Trigger: domain.Trigger{Type: domain.TriggerTime, AtModelTime: pFloat(100)}},
		},
		ReferenceActions: []domain.ReferenceAction{
			{Step: 1, Description: "Прекратить плановые переключения клапанов",
				Expected: domain.ExpectedAction{Target: "ALL-VALVES", Action: "freeze"}, DeadlineSeconds: 10, Mandatory: true},
			{Step: 2, Description: "Направить персонал для визуального контроля клапанов",
				Expected: domain.ExpectedAction{Target: "FIELD-CHECK", Action: "dispatch"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 3, Description: "Проверить, что отсекатели топлива печей закрылись",
				Expected: domain.ExpectedAction{Target: "FURNACE-FUEL-VALVES", Action: "check_closed"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 4, Description: "Перевести установку в аварийный останов, подать пар в печи",
				Expected: domain.ExpectedAction{Target: "ESD-ATM", Action: "confirm"}, DeadlineSeconds: 60, Mandatory: true},
		},
		Criteria: defaultCriteria(),
	}
}
