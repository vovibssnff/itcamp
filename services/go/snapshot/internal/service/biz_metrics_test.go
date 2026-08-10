package service

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
)

func counterValue(t *testing.T, name string, labels map[string]string) float64 {
	t.Helper()
	families, err := prometheus.DefaultGatherer.Gather()
	if err != nil {
		t.Fatalf("gather: %v", err)
	}
	for _, f := range families {
		if f.GetName() != name {
			continue
		}
		for _, m := range f.Metric {
			if matchLabels(m, labels) {
				return m.GetCounter().GetValue()
			}
		}
	}
	return 0
}

func matchLabels(m *dto.Metric, want map[string]string) bool {
	if len(m.Label) != len(want) {
		return len(m.Label) == 0 && len(want) == 0
	}
	for _, lp := range m.Label {
		if v, ok := want[lp.GetName()]; !ok || lp.GetValue() != v {
			return false
		}
	}
	return true
}

func TestBizMetrics_SnapshotSavedByPreset(t *testing.T) {
	before := counterValue(t, "snapshot_snapshots_saved_total", map[string]string{"preset": "true"})
	IncSnapshotSaved(true)
	IncSnapshotSaved(true)
	after := counterValue(t, "snapshot_snapshots_saved_total", map[string]string{"preset": "true"})
	if after-before != 2 {
		t.Fatalf("preset delta = %v, want 2", after-before)
	}
}

func TestBizMetrics_SnapshotRestoreCounters(t *testing.T) {
	restoredBefore := counterValue(t, "snapshot_snapshots_restored_total", map[string]string{})
	invalidBefore := counterValue(t, "snapshot_restore_sha_invalid_total", map[string]string{})

	IncSnapshotRestored()
	IncSnapshotRestoreInvalid()

	restoredAfter := counterValue(t, "snapshot_snapshots_restored_total", map[string]string{})
	invalidAfter := counterValue(t, "snapshot_restore_sha_invalid_total", map[string]string{})

	if restoredAfter-restoredBefore != 1 {
		t.Fatalf("restored delta = %v, want 1", restoredAfter-restoredBefore)
	}
	if invalidAfter-invalidBefore != 1 {
		t.Fatalf("invalid delta = %v, want 1", invalidAfter-invalidBefore)
	}
}
