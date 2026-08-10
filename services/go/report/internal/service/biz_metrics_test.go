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

func TestBizMetrics_ReportCreatedByType(t *testing.T) {
	before := counterValue(t, "report_reports_created_total", map[string]string{"type": "exam"})
	IncReportCreated("exam")
	IncReportCreated("exam")
	after := counterValue(t, "report_reports_created_total", map[string]string{"type": "exam"})
	if after-before != 2 {
		t.Fatalf("created delta = %v, want 2", after-before)
	}
}

func TestBizMetrics_ReportStatusCounters(t *testing.T) {
	genBefore := counterValue(t, "report_reports_generated_total", map[string]string{})
	failBefore := counterValue(t, "report_reports_failed_total", map[string]string{})

	IncReportGenerated()
	IncReportFailed()

	genAfter := counterValue(t, "report_reports_generated_total", map[string]string{})
	failAfter := counterValue(t, "report_reports_failed_total", map[string]string{})

	if genAfter-genBefore != 1 {
		t.Fatalf("generated delta = %v, want 1", genAfter-genBefore)
	}
	if failAfter-failBefore != 1 {
		t.Fatalf("failed delta = %v, want 1", failAfter-failBefore)
	}
}
