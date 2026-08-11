package service

import (
	"context"
	"log/slog"
	"strings"
	"sync"

	"github.com/itcamp/ktc/services/orchestrator/internal/client"
	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
	"github.com/itcamp/ktc/services/orchestrator/internal/events"
	"github.com/itcamp/ktc/services/orchestrator/internal/repository"
)

type ScenarioData struct {
	Faults []ScenarioFaultData `json:"faults"`
}

type ScenarioFaultData struct {
	ID                  string          `json:"id"`
	FaultID             string          `json:"fault_id"`
	ComponentInstanceID string          `json:"component_instance_id"`
	Params              FaultParamsData `json:"params"`
	Trigger             TriggerData     `json:"trigger"`
}

type FaultParamsData struct {
	SeverityPct float64 `json:"severity_pct"`
	RampSeconds float64 `json:"ramp_seconds"`
}

type TriggerData struct {
	Type        string         `json:"type"`
	AtModelTime *float64       `json:"at_model_time,omitempty"`
	Condition   *ConditionData `json:"condition,omitempty"`
}

type ConditionData struct {
	Tag   string  `json:"tag"`
	Op    string  `json:"op"`
	Value float64 `json:"value"`
}

// legacyScenarioFaultIDs maps old scenario-catalog IDs → sim-engine FLT-* catalog.
// Prefer seeds that already use FLT-*; this keeps older DB rows injectable.
var legacyScenarioFaultIDs = map[string]string{
	"level_drop_dehydrator":    "FLT-ELOU-INTERFACE-LOW",
	"pressure_rise_dehydrator": "FLT-ELOU-PRESSURE-HIGH",
	"feed_flow_drop":           "FLT-FEED-FLOW-LOW",
	"cot_rise_furnace":         "FLT-P3-COT-HIGH",
	"pressure_rise_K1":         "FLT-K1-PRESSURE-HIGH",
	"level_drop_K1":            "FLT-K1-LEVEL-LOW",
	"vacuum_loss_K2":           "FLT-K2-VACUUM-LOSS",
	"level_drop_K3_1":          "FLT-K31-LEVEL-LOW",
	"pressure_rise_K4":         "FLT-K4-PRESSURE-HIGH",
	"instrument_air_loss":      "FLT-IA-PRESSURE-LOW",
}

func MapSimFaultID(faultID string) string {
	if mapped, ok := legacyScenarioFaultIDs[faultID]; ok {
		return mapped
	}
	return faultID
}

func normalizeTagID(tag string) string {
	return strings.ReplaceAll(strings.TrimSpace(tag), "-", " ")
}

type TriggerEngine struct {
	log       *slog.Logger
	mu        sync.Mutex
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
	e.mu.Lock()
	defer e.mu.Unlock()
	e.scenarios[sessionID] = data
}

// CheckTriggers evaluates scenario faults and injects those that fire.
// Returns successfully injected fault events (for WS broadcast).
func (e *TriggerEngine) CheckTriggers(
	ctx context.Context,
	sessionID string,
	modelTime float64,
	tags []domain.Tag,
	sim client.SimClient,
	repo *repository.SessionRepo,
	publisher *events.Publisher,
) []domain.FaultEvent {
	e.mu.Lock()
	scenario, ok := e.scenarios[sessionID]
	e.mu.Unlock()
	if !ok {
		return nil
	}

	tagMap := make(map[string]float64, len(tags)*2)
	for _, t := range tags {
		tagMap[t.TagID] = t.Value
		tagMap[normalizeTagID(t.TagID)] = t.Value
	}

	var fired []domain.FaultEvent

	for _, fault := range scenario.Faults {
		key := sessionID + ":" + fault.ID
		e.mu.Lock()
		if e.firedMap[key] {
			e.mu.Unlock()
			continue
		}
		e.mu.Unlock()

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
				condTag := fault.Trigger.Condition.Tag
				val, exists := tagMap[condTag]
				if !exists {
					val, exists = tagMap[normalizeTagID(condTag)]
				}
				if exists && checkCondition(val, fault.Trigger.Condition.Op, fault.Trigger.Condition.Value) {
					shouldFire = true
					triggerType = "condition"
				}
			}
		}

		if !shouldFire {
			continue
		}

		e.mu.Lock()
		e.firedMap[key] = true
		e.mu.Unlock()

		simFaultID := MapSimFaultID(fault.FaultID)
		req := domain.InjectFaultReq{
			SessionID:           sessionID,
			FaultID:             simFaultID,
			ComponentInstanceID: fault.ComponentInstanceID,
			SeverityPct:         fault.Params.SeverityPct,
			RampSeconds:         fault.Params.RampSeconds,
		}

		if err := sim.InjectFault(ctx, req); err != nil {
			e.log.Error("inject fault failed", "session", sessionID, "fault", simFaultID, "error", err)
			continue
		}

		faultEvent := domain.FaultEvent{
			ID:             newUUID(),
			SessionID:      sessionID,
			FaultID:        simFaultID,
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
		IncFaultInjected()
		fired = append(fired, faultEvent)

		e.log.Info("fault injected", "session", sessionID, "fault", simFaultID, "trigger", triggerType, "model_time", modelTime)
	}
	return fired
}

func (e *TriggerEngine) Reset(sessionID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
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
