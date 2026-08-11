package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/jung-kurt/gofpdf"

	"github.com/itcamp/ktc/services/report/internal/domain"
	"github.com/itcamp/ktc/services/report/internal/repository"
)

type ReportStorage interface {
	Save(ctx context.Context, key string, data []byte) error
}

type ReportService struct {
	repo    *repository.ReportRepo
	storage ReportStorage
	log     *slog.Logger
}

func NewReportService(repo *repository.ReportRepo, storage ReportStorage, log *slog.Logger) *ReportService {
	return &ReportService{repo: repo, storage: storage, log: log}
}

func (s *ReportService) Create(ctx context.Context, sessionID string, reportType domain.ReportType) (domain.Report, error) {
	rep := domain.Report{
		ID:        newUUID(),
		SessionID: sessionID,
		Type:      reportType,
		Status:    domain.StatusQueued,
	}
	if err := s.repo.Create(ctx, rep); err != nil {
		return domain.Report{}, err
	}
	IncReportCreated(string(rep.Type))
	return rep, nil
}

func (s *ReportService) Get(ctx context.Context, id string) (domain.Report, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *ReportService) ListBySession(ctx context.Context, sessionID string) ([]domain.Report, error) {
	return s.repo.ListBySession(ctx, sessionID)
}

func (s *ReportService) ProcessTask(ctx context.Context, task domain.ReportTask) error {
	s.log.Info("processing report task", "report_id", task.ReportID, "session", task.SessionID)

	if err := s.repo.UpdateStatus(ctx, task.ReportID, domain.StatusProcessing, ""); err != nil {
		return err
	}

	data, err := s.collectSessionData(ctx, task.SessionID)
	if err != nil {
		_ = s.repo.UpdateStatus(ctx, task.ReportID, domain.StatusFailed, err.Error())
		IncReportFailed()
		return err
	}

	canonicalJSON, _ := json.Marshal(data)

	pdfBytes, err := GeneratePDF(data)
	if err != nil {
		_ = s.repo.UpdateStatus(ctx, task.ReportID, domain.StatusFailed, err.Error())
		IncReportFailed()
		return err
	}

	// Persist PDF when object storage is wired. Download always regenerates from
	// canonical_json, so a missing storage backend must not invent a storage_key
	// that would make clients follow a dead redirect.
	storageKey := storageKeyForReport(s.storage, task.SessionID, task.ReportID)
	if s.storage != nil {
		if err := s.storage.Save(ctx, storageKey, pdfBytes); err != nil {
			s.log.Error("pdf save failed", "error", err)
			_ = s.repo.UpdateStatus(ctx, task.ReportID, domain.StatusFailed, err.Error())
			IncReportFailed()
			return err
		}
	}

	if err := s.repo.SetReady(ctx, task.ReportID, string(canonicalJSON), storageKey); err != nil {
		IncReportFailed()
		return err
	}
	IncReportGenerated()

	s.log.Info("report generated", "report_id", task.ReportID, "session", task.SessionID)
	return nil
}

// DownloadPDF returns the PDF for a ready report by regenerating it from the
// stored canonical session JSON. This keeps downloads working when object
// storage is nil or the legacy /file redirect target is absent.
func (s *ReportService) DownloadPDF(ctx context.Context, id string) ([]byte, error) {
	rep, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if rep.Status != domain.StatusReady {
		return nil, domain.ErrReportNotReady
	}
	return PDFFromCanonicalJSON(rep.CanonicalJSON)
}

// PDFFromCanonicalJSON rebuilds a session PDF from the persisted canonical JSON.
func PDFFromCanonicalJSON(canonicalJSON string) ([]byte, error) {
	if canonicalJSON == "" {
		return nil, domain.ErrGenerationFailed
	}
	var data domain.SessionData
	if err := json.Unmarshal([]byte(canonicalJSON), &data); err != nil {
		return nil, fmt.Errorf("%w: invalid canonical json: %v", domain.ErrGenerationFailed, err)
	}
	return GeneratePDF(data)
}

// storageKeyForReport returns the object-storage key only when a backend is configured.
func storageKeyForReport(storage ReportStorage, sessionID, reportID string) string {
	if storage == nil {
		return ""
	}
	return fmt.Sprintf("reports/%s/%s.pdf", sessionID, reportID)
}

func (s *ReportService) collectSessionData(ctx context.Context, sessionID string) (domain.SessionData, error) {
	data := domain.SessionData{
		SessionID: sessionID,
	}

	score, err := s.repo.GetScore(ctx, sessionID)
	if err == nil {
		data.Score = score.TotalScore
		data.Verdict = string(score.Verdict)
		for _, p := range score.Penalties {
			data.Penalties = append(data.Penalties, domain.PenaltyData{
				Code: p.Code, Description: p.Description, Points: p.Points, ModelTime: p.ModelTime,
			})
		}
		for _, c := range score.CriticalErrors {
			data.CriticalErrs = append(data.CriticalErrs, domain.CriticalData{
				Code: c.Code, Description: c.Description, ModelTime: c.ModelTime,
			})
		}
	}

	actions, _ := s.repo.GetActions(ctx, sessionID)
	data.Actions = actions

	alarms, _ := s.repo.GetAlarms(ctx, sessionID)
	data.Alarms = alarms

	faults, _ := s.repo.GetFaults(ctx, sessionID)
	data.Faults = faults

	return data, nil
}

func GeneratePDF(data domain.SessionData) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(40, 10, "Отчёт по сессии")
	pdf.Ln(12)

	pdf.SetFont("Arial", "", 10)
	pdf.Cell(40, 6, fmt.Sprintf("ID сессии: %s", data.SessionID))
	pdf.Ln(6)
	pdf.Cell(40, 6, fmt.Sprintf("Режим: %s", data.Mode))
	pdf.Ln(6)
	pdf.Cell(40, 6, fmt.Sprintf("Сценарий: %s", data.ScenarioName))
	pdf.Ln(6)
	pdf.Cell(40, 6, fmt.Sprintf("Модельное время: %.1f с", data.ModelTime))
	pdf.Ln(6)
	pdf.Cell(40, 6, fmt.Sprintf("Оценка: %d", data.Score))
	pdf.Ln(6)
	pdf.Cell(40, 6, fmt.Sprintf("Вердикт: %s", data.Verdict))
	pdf.Ln(10)

	if len(data.Penalties) > 0 {
		pdf.SetFont("Arial", "B", 12)
		pdf.Cell(40, 6, "Штрафы")
		pdf.Ln(6)
		pdf.SetFont("Arial", "", 9)
		for _, p := range data.Penalties {
			pdf.Cell(40, 5, fmt.Sprintf("  %s: %s (-%d)", p.Code, p.Description, p.Points))
			pdf.Ln(5)
		}
		pdf.Ln(4)
	}

	if len(data.CriticalErrs) > 0 {
		pdf.SetFont("Arial", "B", 12)
		pdf.Cell(40, 6, "Критические ошибки")
		pdf.Ln(6)
		pdf.SetFont("Arial", "", 9)
		for _, c := range data.CriticalErrs {
			pdf.Cell(40, 5, fmt.Sprintf("  %s: %s", c.Code, c.Description))
			pdf.Ln(5)
		}
		pdf.Ln(4)
	}

	if len(data.Actions) > 0 {
		pdf.SetFont("Arial", "B", 12)
		pdf.Cell(40, 6, "Действия оператора")
		pdf.Ln(6)
		pdf.SetFont("Arial", "", 9)
		for _, a := range data.Actions {
			pdf.Cell(40, 5, fmt.Sprintf("  t=%.1f: %s -> %s", a.ModelTime, a.Target, a.Action))
			pdf.Ln(5)
		}
		pdf.Ln(4)
	}

	if len(data.Alarms) > 0 {
		pdf.SetFont("Arial", "B", 12)
		pdf.Cell(40, 6, "Алармы")
		pdf.Ln(6)
		pdf.SetFont("Arial", "", 9)
		for _, a := range data.Alarms {
			pdf.Cell(40, 5, fmt.Sprintf("  t=%.1f: %s [%s]", a.ModelTime, a.TagID, a.Priority))
			pdf.Ln(5)
		}
		pdf.Ln(4)
	}

	if len(data.Faults) > 0 {
		pdf.SetFont("Arial", "B", 12)
		pdf.Cell(40, 6, "Неисправности")
		pdf.Ln(6)
		pdf.SetFont("Arial", "", 9)
		for _, f := range data.Faults {
			pdf.Cell(40, 5, fmt.Sprintf("  t=%.1f: %s", f.ModelTime, f.FaultID))
			pdf.Ln(5)
		}
	}

	pdf.SetFont("Arial", "I", 8)
	pdf.Ln(10)
	pdf.Cell(40, 5, fmt.Sprintf("Сгенерировано: %s", time.Now().UTC().Format(time.RFC3339)))

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("pdf output: %w", err)
	}
	return buf.Bytes(), nil
}
