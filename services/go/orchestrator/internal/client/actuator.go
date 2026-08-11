package client

import (
	"math"
	"strings"
)

// Legacy / seed aliases → sim-engine pump tags (template_atm_demo.json).
var pumpTagAliases = map[string]string{
	"PUMP-N7":  "PUMP-N3",
	"PUMP-N14": "PUMP-N4",
	"PUMP N7":  "PUMP-N3",
	"PUMP N14": "PUMP-N4",
}

// CanonicalActuatorTag normalizes SPA tag IDs onto sim Model API targets.
func CanonicalActuatorTag(tag string) string {
	t := strings.TrimSpace(tag)
	upper := strings.ToUpper(strings.ReplaceAll(t, " ", "-"))
	if alias, ok := pumpTagAliases[upper]; ok {
		return alias
	}
	if strings.HasPrefix(upper, "PUMP-") || strings.HasPrefix(upper, "FAN-") ||
		strings.HasPrefix(upper, "XV-") || strings.HasPrefix(upper, "ZV-") {
		return upper
	}
	return t
}

// ResolveActuatorCommand maps SPA actuator writes onto sim Model API commands.
// Pumps/fans use START/STOP; valve-like tags use OPEN/CLOSE; otherwise SET_SP.
func ResolveActuatorCommand(tag string, value any) (cmdType string, cmdValue any) {
	tag = CanonicalActuatorTag(tag)
	norm := strings.ToUpper(strings.TrimSpace(strings.ReplaceAll(tag, "-", " ")))
	f, ok := toFloat(value)

	switch {
	case strings.HasPrefix(norm, "PUMP"), strings.HasPrefix(norm, "FAN"):
		if ok && f > 0.5 {
			return "START", nil
		}
		return "STOP", nil
	case strings.HasPrefix(norm, "XV"), strings.HasPrefix(norm, "ZV"),
		strings.Contains(norm, "VALVE"), strings.HasPrefix(norm, "GATE"):
		if ok && f > 50 {
			return "OPEN", nil
		}
		if ok && f > 0.5 && f <= 1.0 {
			return "OPEN", nil
		}
		return "CLOSE", nil
	default:
		if !ok {
			return "SET_SP", value
		}
		if math.IsNaN(f) {
			return "SET_SP", value
		}
		return "SET_SP", f
	}
}
