package service

import (
	"fmt"

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
			alarmByTag[a.TagID] = a.Priority
		}
	}
	out := make([]map[string]any, 0, len(tags))
	for _, t := range tags {
		out = append(out, tagValueForWS(t, modelTime, alarmByTag[t.TagID]))
	}
	return out
}
