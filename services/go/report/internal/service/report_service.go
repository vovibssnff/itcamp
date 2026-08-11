package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/jung-kurt/gofpdf"

	"github.com/itcamp/ktc/shared/go/ktccatalog"
	"github.com/itcamp/ktc/services/report/internal/domain"
	"github.com/itcamp/ktc/services/report/internal/repository"
)

type ReportStorage interface {
	Save(ctx context.Context, key string, data []byte) error
	Load(ctx context.Context, key string) ([]byte, error)
}

type TaskPublisher interface {
	PublishReportTask(ctx context.Context, task domain.ReportTask) error
}

type ReportService struct {
	repo      *repository.ReportRepo
	storage   ReportStorage
	publisher TaskPublisher
	log       *slog.Logger
}

func NewReportService(repo *repository.ReportRepo, storage ReportStorage, publisher TaskPublisher, log *slog.Logger) *ReportService {
	return &ReportService{repo: repo, storage: storage, publisher: publisher, log: log}
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

	if s.publisher != nil {
		task := domain.ReportTask{ReportID: rep.ID, SessionID: sessionID, Type: string(reportType)}
		if err := s.publisher.PublishReportTask(ctx, task); err != nil {
			s.log.Error("failed to publish report task", "report_id", rep.ID, "error", err)
		}
	}

	return rep, nil
}

func (s *ReportService) Get(ctx context.Context, id string) (domain.Report, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *ReportService) ListBySession(ctx context.Context, sessionID string) ([]domain.Report, error) {
	return s.repo.ListBySession(ctx, sessionID)
}

// ListAll — все отчёты для admin/instructor, либо отчёты оператора по его id.
// Пустой operatorID означает «все».
func (s *ReportService) ListAll(ctx context.Context, operatorID string) ([]domain.Report, error) {
	return s.repo.ListAll(ctx, operatorID)
}

// Download возвращает PDF-байты готового отчёта из хранилища.
func (s *ReportService) Download(ctx context.Context, id string) ([]byte, error) {
	rep, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if rep.Status != domain.StatusReady {
		return nil, domain.ErrReportNotReady
	}
	if s.storage == nil || rep.StorageKey == "" {
		return nil, domain.ErrReportNotReady
	}
	return s.storage.Load(ctx, rep.StorageKey)
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

	storageKey := fmt.Sprintf("reports/%s/%s.pdf", task.SessionID, task.ReportID)

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

	downloadURL := fmt.Sprintf("/api/v1/reports/%s/file", task.ReportID)
	_ = s.repo.SetDownloadURL(ctx, task.ReportID, downloadURL)

	s.log.Info("report generated", "report_id", task.ReportID, "session", task.SessionID)
	return nil
}

func (s *ReportService) collectSessionData(ctx context.Context, sessionID string) (domain.SessionData, error) {
	data, err := s.repo.GetSessionMeta(ctx, sessionID)
	if err != nil {
		s.log.Warn("failed to load session metadata", "session", sessionID, "error", err)
		data = domain.SessionData{SessionID: sessionID}
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
	for i := range alarms {
		alarms[i].Description = ktccatalog.TagDescriptionOf(alarms[i].TagID)
	}
	data.Alarms = alarms

	faults, _ := s.repo.GetFaults(ctx, sessionID)
	for i := range faults {
		faults[i].Description = ktccatalog.FaultDescription(faults[i].FaultID)
	}
	data.Faults = faults

	return data, nil
}

func GeneratePDF(data domain.SessionData) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	// Встроенный шрифт с кириллицей — дефолтный core-шрифт "Arial" (WinAnsi)
	// не поддерживает русские символы и ломает кодировку текста в PDF.
	pdf.AddUTF8FontFromBytes("Arial", "", arialTTF)
	pdf.AddUTF8FontFromBytes("Arial", "B", arialTTF)
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
			pdf.Cell(40, 5, fmt.Sprintf("  t=%.1f: %s [%s] — %s", a.ModelTime, a.TagID, a.Priority, a.Description))
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
			pdf.Cell(40, 5, fmt.Sprintf("  t=%.1f: %s — %s", f.ModelTime, f.FaultID, f.Description))
			pdf.Ln(5)
		}
	}

	pdf.SetFont("Arial", "", 8)
	pdf.Ln(10)
	pdf.Cell(40, 5, fmt.Sprintf("Сгенерировано: %s", time.Now().UTC().Format(time.RFC3339)))

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("pdf output: %w", err)
	}
	return buf.Bytes(), nil
}
