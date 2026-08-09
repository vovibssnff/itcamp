package service

import (
	"bytes"
	"testing"

	"github.com/itcamp/ktc/services/report/internal/domain"
)

func TestGeneratePDF_BasicReport(t *testing.T) {
	data := domain.SessionData{
		SessionID:    "sess-test-001",
		Mode:         "training",
		ScenarioName: "Рост давления в К-1",
		ModelTime:    812.5,
		Score:        75,
		Verdict:      "pass",
	}

	pdfBytes, err := GeneratePDF(data)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatal("expected non-empty PDF")
	}
	if !bytes.HasPrefix(pdfBytes, []byte("%PDF")) {
		t.Error("expected PDF header")
	}
}

func TestGeneratePDF_WithPenalties(t *testing.T) {
	data := domain.SessionData{
		SessionID: "sess-002",
		Mode:      "exam",
		Score:     55,
		Verdict:   "fail",
		Penalties: []domain.PenaltyData{
			{Code: "LATE_STEP", Description: "шаг 1 просрочен", Points: 10, ModelTime: 150},
			{Code: "MISSED_STEP", Description: "шаг 2 пропущен", Points: 25, ModelTime: 200},
		},
	}

	pdfBytes, err := GeneratePDF(data)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatal("expected non-empty PDF")
	}
}

func TestGeneratePDF_WithCriticalErrors(t *testing.T) {
	data := domain.SessionData{
		SessionID: "sess-003",
		Score:     30,
		Verdict:   "fail",
		CriticalErrs: []domain.CriticalData{
			{Code: "esd_without_reason", Description: "необоснованный ESD", ModelTime: 500},
		},
	}

	pdfBytes, err := GeneratePDF(data)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatal("expected non-empty PDF")
	}
}

func TestGeneratePDF_WithActions(t *testing.T) {
	data := domain.SessionData{
		SessionID: "sess-004",
		Score:     90,
		Verdict:   "pass",
		Actions: []domain.ActionData{
			{Target: "TRC-3", Action: "decrease", ModelTime: 110},
			{Target: "FRC-408", Action: "increase", ModelTime: 120},
			{Target: "ESD-ATM", Action: "confirm", ModelTime: 200},
		},
	}

	pdfBytes, err := GeneratePDF(data)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatal("expected non-empty PDF")
	}
}

func TestGeneratePDF_EmptyData(t *testing.T) {
	data := domain.SessionData{}

	pdfBytes, err := GeneratePDF(data)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatal("expected non-empty PDF even for empty data")
	}
}

func TestGeneratePDF_AllSections(t *testing.T) {
	data := domain.SessionData{
		SessionID:    "sess-full",
		Mode:         "exam",
		ScenarioName: "Полный сценарий",
		ModelTime:    1000.0,
		Score:        65,
		Verdict:      "fail",
		Penalties: []domain.PenaltyData{
			{Code: "LATE_STEP", Description: "просрочка", Points: 10, ModelTime: 100},
		},
		CriticalErrs: []domain.CriticalData{
			{Code: "wrong_paz_override", Description: "неправильный обход ПАЗ", ModelTime: 300},
		},
		Actions: []domain.ActionData{
			{Target: "TRC-3", Action: "decrease", ModelTime: 50},
		},
		Alarms: []domain.AlarmData{
			{TagID: "PRSA-204", Priority: "H", ModelTime: 80},
		},
		Faults: []domain.FaultData{
			{FaultID: "pressure_rise_K1", ModelTime: 180},
		},
	}

	pdfBytes, err := GeneratePDF(data)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}
	if len(pdfBytes) < 1000 {
		t.Errorf("expected substantial PDF, got %d bytes", len(pdfBytes))
	}
}

func TestGeneratePDF_Cyrillic(t *testing.T) {
	data := domain.SessionData{
		SessionID:    "sess-ru",
		ScenarioName: "Рост давления в колонне К-1 до блокировки",
		Mode:         "training",
		Verdict:      "pass",
	}

	pdfBytes, err := GeneratePDF(data)
	if err != nil {
		t.Fatalf("GeneratePDF failed: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatal("expected non-empty PDF with cyrillic")
	}
}
