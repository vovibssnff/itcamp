package domain

type Fault struct {
	FaultID                  string        `json:"fault_id"`
	Name                     string        `json:"name"`
	ApplicableComponentTypes []string      `json:"applicable_component_types"`
	Description              string        `json:"description"`
	AffectedTags             []string      `json:"affected_tags"`
	Severity                 FaultSeverity `json:"severity"`
	DamagePerSec             float64       `json:"damage_per_sec"`
}
