package seeds

import (
	"strings"
	"testing"
)

func TestFaultsCatalog_UsesSimEngineIDs(t *testing.T) {
	want := map[string]bool{
		"FLT-ELOU-INTERFACE-LOW": true,
		"FLT-ELOU-PRESSURE-HIGH": true,
		"FLT-FEED-FLOW-LOW":      true,
		"FLT-P3-COT-HIGH":        true,
		"FLT-K1-PRESSURE-HIGH":   true,
		"FLT-K1-LEVEL-LOW":       true,
		"FLT-K2-VACUUM-LOSS":     true,
		"FLT-K31-LEVEL-LOW":      true,
		"FLT-K4-PRESSURE-HIGH":   true,
		"FLT-IA-PRESSURE-LOW":    true,
	}
	for _, f := range FaultsCatalog() {
		if !want[f.FaultID] {
			t.Fatalf("unexpected fault_id %q", f.FaultID)
		}
		delete(want, f.FaultID)
		for _, tag := range f.AffectedTags {
			if strings.Contains(tag, "-") && !strings.Contains(tag, " ") {
				// Allow TR 55-9 style (digit hyphen) but not PRSA-204.
				parts := strings.Split(tag, "-")
				if len(parts) == 2 && parts[0] != "" && parts[1] != "" {
					// "PRSA-204" has no space — reject letter-letter hyphen catalogs.
					if !containsDigit(parts[0]) {
						t.Fatalf("AffectedTags should use sim space form, got %q on %s", tag, f.FaultID)
					}
				}
			}
		}
		if len(f.AffectedTags) == 0 {
			t.Fatalf("%s: empty AffectedTags", f.FaultID)
		}
	}
	if len(want) != 0 {
		t.Fatalf("missing fault ids: %v", want)
	}
}

func containsDigit(s string) bool {
	for _, r := range s {
		if r >= '0' && r <= '9' {
			return true
		}
	}
	return false
}

func TestDemoScenarios_FaultIDsMatchSimCatalog(t *testing.T) {
	catalog := map[string]bool{}
	for _, f := range FaultsCatalog() {
		catalog[f.FaultID] = true
	}
	for _, sc := range DemoScenarios() {
		for _, fault := range sc.Faults {
			if !catalog[fault.FaultID] {
				t.Fatalf("scenario %s references unknown fault %q", sc.ID, fault.FaultID)
			}
			if !strings.HasPrefix(fault.FaultID, "FLT-") {
				t.Fatalf("scenario %s fault_id %q should be FLT-*", sc.ID, fault.FaultID)
			}
			if fault.Trigger.Condition != nil {
				tag := fault.Trigger.Condition.Tag
				if strings.Contains(tag, "-") && !strings.Contains(tag, " ") {
					// e.g. PRA-312 — prefer "PRA 312"
					left := strings.SplitN(tag, "-", 2)[0]
					if left != "" && !containsDigit(left) {
						t.Fatalf("scenario %s condition tag %q should use space form", sc.ID, tag)
					}
				}
			}
		}
	}
}
