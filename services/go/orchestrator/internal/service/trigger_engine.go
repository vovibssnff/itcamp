package service

import (
	"context"
	"log/slog"

	"github.com/itcamp/ktc/services/orchestrator/internal/client"
	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
	"github.com/itcamp/ktc/services/orchestrator/internal/events"
	"github.com/itcamp/ktc/services/orchestrator/internal/repository"
)

type ScenarioData struct {
	Faults []ScenarioFaultData `json:"faults"`
}

type ScenarioFaultData struct {
	ID                  string         `json:"id"`
	FaultID             string         `json:"fault_id"`
	ComponentInstanceID string         `json:"component_instance_id"`
	Params              FaultParamsData `json:"params"`
	Trigger             TriggerData    `json:"trigger"`
}

type FaultParamsData struct {
	SeverityPct float64 `json:"severity_pct"`
	RampSeconds float64 `json:"ramp_seconds"`
}

type TriggerData struct {
	Type         string          `json:"type"`
	AtModelTime  *float64        `json:"at_model_time,omitempty"`
	Condition    *ConditionData  `json:"condition,omitempty"`
}

type ConditionData struct {
	Tag   string  `json:"tag"`
	Op    string  `json:"op"`
	Value float64 `json:"value"`
}

type TriggerEngine struct {
	log       *slog.Logger
	firedMap  map[string]bool
	scenarios map[string]ScenarioData
}

func NewTriggerEngine(log *slog.Logger) *TriggerEngine {
	return &TriggerEngine{
		log:       log,
		firedMap:  make(map[string]bool),
		scenarios: make(map[string]ScenarioData),
	}
}

func (e *TriggerEngine) LoadScenario(sessionID string, data ScenarioData) {
	e.scenarios[sessionID] = data
}

func (e *TriggerEngine) CheckTriggers(
	ctx context.Context,
	sessionID string,
	modelTime float64,
	tags []domain.Tag,
	sim client.SimClient,
	repo *repository.SessionRepo,
	publisher *events.Publisher,
) {
	scenario, ok := e.scenarios[sessionID]
	if !ok {
		return
	}

	tagMap := make(map[string]float64, len(tags))
	for _, t := range tags {
		tagMap[t.TagID] = t.Value
	}

	for _, fault := range scenario.Faults {
		key := sessionID + ":" + fault.ID
		if e.firedMap[key] {
			continue
		}

		shouldFire := false
		var triggerType string

		switch fault.Trigger.Type {
		case "time":
			if fault.Trigger.AtModelTime != nil && modelTime >= *fault.Trigger.AtModelTime {
				shouldFire = true
				triggerType = "time"
			}
		case "condition":
			if fault.Trigger.Condition != nil {
				val, exists := tagMap[fault.Trigger.Condition.Tag]
				if exists && checkCondition(val, fault.Trigger.Condition.Op, fault.Trigger.Condition.Value) {
					shouldFire = true
					triggerType = "condition"
				}
			}
		}

		if !shouldFire {
			continue
		}

		e.firedMap[key] = true

		req := domain.InjectFaultReq{
			SessionID:           sessionID,
			FaultID:             fault.FaultID,
			ComponentInstanceID: fault.ComponentInstanceID,
			SeverityPct:         fault.Params.SeverityPct,
			RampSeconds:         fault.Params.RampSeconds,
		}

		if err := sim.InjectFault(ctx, req); err != nil {
			e.log.Error("inject fault failed", "session", sessionID, "fault", fault.FaultID, "error", err)
			continue
		}

		faultEvent := domain.FaultEvent{
			ID:             newUUID(),
			SessionID:      sessionID,
			FaultID:        fault.FaultID,
			ComponentID:    fault.ComponentInstanceID,
			TriggerType:    triggerType,
			FiredModelTime: modelTime,
		}
		if repo != nil {
			_ = repo.RecordFaultEvent(ctx, faultEvent)
		}
		if publisher != nil {
			_ = publisher.PublishSessionEvent(ctx, sessionID, "fault_fired", faultEvent)
		}

		e.log.Info("fault injected", "session", sessionID, "fault", fault.FaultID, "trigger", triggerType, "model_time", modelTime)
	}
}

func (e *TriggerEngine) Reset(sessionID string) {
	for k := range e.firedMap {
		if len(k) > len(sessionID) && k[:len(sessionID)] == sessionID {
			delete(e.firedMap, k)
		}
	}
	delete(e.scenarios, sessionID)
}

func checkCondition(value float64, op string, threshold float64) bool {
	switch op {
	case ">=":
		return value >= threshold
	case "<=":
		return value <= threshold
	case ">":
		return value > threshold
	case "<":
		return value < threshold
	case "==":
		return value == threshold
	}
	return false
}
