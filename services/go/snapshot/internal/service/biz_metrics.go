package service

import (
	"github.com/prometheus/client_golang/prometheus"
)

// Бизнес-метрики snapshot. Регистрируются в дефолтном реестре Prometheus,
// который отдаёт общий /metrics-хендлер (shared/pkg/metrics.Handler).
var (
	snapshotsSavedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "snapshot_snapshots_saved_total",
			Help: "Total saved snapshots by preset flag",
		},
		[]string{"preset"},
	)
	snapshotsRestoredTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "snapshot_snapshots_restored_total",
			Help: "Total restored snapshots",
		},
	)
	snapshotsRestoreInvalidTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "snapshot_restore_sha_invalid_total",
			Help: "Total restores with SHA256 mismatch",
		},
	)
	snapshotsDeletedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "snapshot_snapshots_deleted_total",
			Help: "Total deleted snapshots",
		},
	)
)

func init() {
	prometheus.MustRegister(
		snapshotsSavedTotal,
		snapshotsRestoredTotal,
		snapshotsRestoreInvalidTotal,
		snapshotsDeletedTotal,
	)
}

func IncSnapshotSaved(preset bool) {
	snapshotsSavedTotal.WithLabelValues(boolStr(preset)).Inc()
}

func IncSnapshotRestored() {
	snapshotsRestoredTotal.Inc()
}

func IncSnapshotRestoreInvalid() {
	snapshotsRestoreInvalidTotal.Inc()
}

func IncSnapshotDeleted() {
	snapshotsDeletedTotal.Inc()
}

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
