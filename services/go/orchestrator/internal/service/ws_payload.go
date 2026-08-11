package service

import (
	"fmt"
	"strings"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

// tagValueForWS maps a domain Tag into the SPA TagValue shape.
func tagValueForWS(t domain.Tag, modelTime float64, alarmState string) map[string]any {
	if alarmState == "" {
		alarmState = "normal"
	}
	return map[string]any{
		"tag":        t.TagID,
		"value":      t.Value,
		"unit":       t.Unit,
		"alarmState": alarmState,
		"timestamp":  modelTime,
	}
}

// alarmForWS maps a domain AlarmEvent into the SPA ActiveAlarm shape.
func alarmForWS(a domain.AlarmEvent) map[string]any {
	level := a.Priority
	if level == "" {
		level = "H"
	}
	return map[string]any{
		"id":           a.ID,
		"tag":          a.TagID,
		"level":        level,
		"message":      fmt.Sprintf("%s · %s", a.TagID, level),
		"timestamp":    a.RaisedModelTime,
		"acknowledged": a.AckModelTime != nil,
	}
}

func tagsForWS(tags []domain.Tag, modelTime float64, alarms []domain.AlarmEvent) []map[string]any {
	alarmByTag := make(map[string]string, len(alarms))
	for _, a := range alarms {
		if a.AckModelTime == nil && a.TagID != "" {
			key := normalizeTagKey(a.TagID)
			prio := strings.ToUpper(strings.TrimSpace(a.Priority))
			if prio == "" {
				prio = "H"
			}
			alarmByTag[key] = prio
			alarmByTag[a.TagID] = prio
		}
	}
	out := make([]map[string]any, 0, len(tags))
	for _, t := range tags {
		state := alarmByTag[t.TagID]
		if state == "" {
			state = alarmByTag[normalizeTagKey(t.TagID)]
		}
		out = append(out, tagValueForWS(t, modelTime, state))
	}
	return out
}

func normalizeTagKey(tag string) string {
	s := strings.TrimSpace(tag)
	s = strings.ReplaceAll(s, "-", " ")
	s = strings.ReplaceAll(s, "_", " ")
	for strings.Contains(s, "  ") {
		s = strings.ReplaceAll(s, "  ", " ")
	}
	return strings.ToUpper(s)
}

// TelemetryTagsForWS maps a cached Telemetry snapshot into the SPA telemetry tags array.
func TelemetryTagsForWS(t domain.Telemetry) []map[string]any {
	return tagsForWS(t.Tags, t.ModelTime, t.Alarms)
}

func regulatorForWS(r domain.Regulator) map[string]any {
	mode := strings.ToLower(strings.TrimSpace(r.Mode))
	if mode != "manual" {
		mode = "auto"
	}
	return map[string]any{
		"tag":  r.TagID,
		"mode": mode,
		"pv":   r.PV,
		"sp":   r.SP,
		"out":  r.OUT,
	}
}

// RegulatorsForWS maps regulator snapshots for SPA regulator_state messages.
func RegulatorsForWS(regs []domain.Regulator) []map[string]any {
	out := make([]map[string]any, 0, len(regs))
	for _, r := range regs {
		if r.TagID == "" {
			continue
		}
		out = append(out, regulatorForWS(r))
	}
	return out
}

func faultForWS(f domain.FaultEvent) map[string]any {
	return map[string]any{
		"id":                    f.ID,
		"fault_id":              f.FaultID,
		"component_instance_id": f.ComponentID,
		"trigger_type":          f.TriggerType,
		"fired_model_time":      f.FiredModelTime,
	}
}
