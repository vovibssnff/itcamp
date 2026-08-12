package service

import (
	"math"
	"strings"
)

// assessmentActionPayload shapes an operator command for the assessment service.
// Scenario seeds use vocabulary like set_mode/start/confirm; the sim/HMI path
// emits SET_MODE/START/ESD. Mapping here keeps journal records intact while
// making reference-action matching work.
func assessmentActionPayload(userID, target, cmdType string, value any, modelTime float64) map[string]any {
	action, mapped := mapSimCommandToAssessment(cmdType, value)
	return map[string]any{
		"user_id":    userID,
		"target":     target,
		"action":     action,
		"value":      mapped,
		"model_time": modelTime,
	}
}

func mapSimCommandToAssessment(cmdType string, value any) (action string, mapped any) {
	switch strings.ToUpper(strings.TrimSpace(cmdType)) {
	case "SET_MODE":
		return "set_mode", modeValueToAssessment(value)
	case "START":
		return "start", value
	case "STOP":
		return "stop", value
	case "ESD":
		// Seeds express emergency stops as confirm on ESD-* targets.
		return "confirm", value
	case "OPEN":
		return "open", value
	case "CLOSE":
		return "close", value
	case "SET_SP":
		return "set_sp", value
	case "SET_OUT":
		return "set_out", value
	case "":
		return "set", value
	default:
		return strings.ToLower(cmdType), value
	}
}

func modeValueToAssessment(value any) any {
	switch v := value.(type) {
	case string:
		s := strings.ToUpper(strings.TrimSpace(v))
		switch s {
		case "MANUAL", "MAN", "1", "TRUE":
			return "MANUAL"
		case "AUTO", "AUT", "0", "FALSE":
			return "AUTO"
		}
		return s
	case bool:
		if v {
			return "MANUAL"
		}
		return "AUTO"
	case float64:
		if v >= 0.5 {
			return "MANUAL"
		}
		return "AUTO"
	case float32:
		if v >= 0.5 {
			return "MANUAL"
		}
		return "AUTO"
	case int:
		if v != 0 {
			return "MANUAL"
		}
		return "AUTO"
	case int64:
		if v != 0 {
			return "MANUAL"
		}
		return "AUTO"
	default:
		if f, ok := toFloat64(value); ok {
			if math.IsNaN(f) {
				return value
			}
			if f >= 0.5 {
				return "MANUAL"
			}
			return "AUTO"
		}
		return value
	}
}

func toFloat64(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	case uint64:
		return float64(n), true
	default:
		return 0, false
	}
}
