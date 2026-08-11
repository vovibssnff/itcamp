package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/itcamp/ktc/services/report/internal/domain"
)

type ReportRepo struct {
	db *Postgres
}

func NewReportRepo(pg *Postgres) *ReportRepo {
	return &ReportRepo{db: pg}
}

const reportCols = `id, session_id, type, status, canonical_json, storage_key, download_url, error, created_at, updated_at`

func (r *ReportRepo) scanReport(row pgx.Row) (domain.Report, error) {
	var rep domain.Report
	if err := row.Scan(&rep.ID, &rep.SessionID, &rep.Type, &rep.Status, &rep.CanonicalJSON, &rep.StorageKey, &rep.DownloadURL, &rep.Error, &rep.CreatedAt, &rep.UpdatedAt); err != nil {
		return domain.Report{}, err
	}
	return rep, nil
}

func (r *ReportRepo) GetByID(ctx context.Context, id string) (domain.Report, error) {
	row := r.db.Pool.QueryRow(ctx, `SELECT `+reportCols+` FROM reports WHERE id = $1`, id)
	rep, err := r.scanReport(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Report{}, domain.ErrReportNotFound
	}
	return rep, err
}

func (r *ReportRepo) ListBySession(ctx context.Context, sessionID string) ([]domain.Report, error) {
	rows, err := r.db.Pool.Query(ctx, `SELECT `+reportCols+` FROM reports WHERE session_id = $1 ORDER BY created_at DESC`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var reports []domain.Report
	for rows.Next() {
		rep, err := r.scanReport(rows)
		if err != nil {
			return nil, err
		}
		reports = append(reports, rep)
	}
	return reports, rows.Err()
}

// ListAll возвращает все отчёты (для admin/instructor) либо только те, что
// относятся к сессиям указанного оператора. Если operatorID пуст — все отчёты.
func (r *ReportRepo) ListAll(ctx context.Context, operatorID string) ([]domain.Report, error) {
	q := `SELECT ` + reportCols + ` FROM reports`
	args := []any{}
	if operatorID != "" {
		q = `SELECT r.id, r.session_id, r.type, r.status, r.canonical_json, r.storage_key, r.download_url, r.error, r.created_at, r.updated_at
		     FROM reports r
		     WHERE r.session_id IN (
		         SELECT id FROM sessions WHERE operator_ids @> to_jsonb($1::text) OR instructor_id = $1
		     )`
		args = append(args, operatorID)
	}
	q += ` ORDER BY created_at DESC`
	rows, err := r.db.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var reports []domain.Report
	for rows.Next() {
		rep, err := r.scanReport(rows)
		if err != nil {
			return nil, err
		}
		reports = append(reports, rep)
	}
	return reports, rows.Err()
}

func (r *ReportRepo) Create(ctx context.Context, rep domain.Report) error {
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO reports (id, session_id, type, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, now(), now())`,
		rep.ID, rep.SessionID, string(rep.Type), string(rep.Status))
	return err
}

func (r *ReportRepo) UpdateStatus(ctx context.Context, id string, status domain.ReportStatus, errMsg string) error {
	tag, err := r.db.Pool.Exec(ctx, `UPDATE reports SET status = $2, error = $3, updated_at = now() WHERE id = $1`,
		id, string(status), errMsg)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrReportNotFound
	}
	return nil
}

func (r *ReportRepo) SetReady(ctx context.Context, id, canonicalJSON, storageKey string) error {
	tag, err := r.db.Pool.Exec(ctx, `UPDATE reports SET status = 'ready', canonical_json = $2, storage_key = $3, updated_at = now() WHERE id = $1`,
		id, canonicalJSON, storageKey)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrReportNotFound
	}
	return nil
}

func (r *ReportRepo) SetDownloadURL(ctx context.Context, id, url string) error {
	_, err := r.db.Pool.Exec(ctx, `UPDATE reports SET download_url = $2, updated_at = now() WHERE id = $1`, id, url)
	return err
}

type ScoreData struct {
	TotalScore     int                   `json:"total_score"`
	Verdict        string                `json:"verdict"`
	Penalties      []domain.PenaltyData  `json:"penalties"`
	CriticalErrors []domain.CriticalData `json:"critical_errors"`
}

func (r *ReportRepo) GetScore(ctx context.Context, sessionID string) (ScoreData, error) {
	var s ScoreData
	var penaltiesJSON, criticalJSON []byte
	err := r.db.Pool.QueryRow(ctx, `SELECT total_score, verdict, penalties, critical_errors FROM assessments WHERE session_id = $1`, sessionID).
		Scan(&s.TotalScore, &s.Verdict, &penaltiesJSON, &criticalJSON)
	if err != nil {
		return ScoreData{}, err
	}
	if err := json.Unmarshal(penaltiesJSON, &s.Penalties); err != nil {
		return ScoreData{}, fmt.Errorf("unmarshal penalties: %w", err)
	}
	if err := json.Unmarshal(criticalJSON, &s.CriticalErrors); err != nil {
		return ScoreData{}, fmt.Errorf("unmarshal critical_errors: %w", err)
	}
	return s, nil
}

func (r *ReportRepo) GetActions(ctx context.Context, sessionID string) ([]domain.ActionData, error) {
	rows, err := r.db.Pool.Query(ctx, `SELECT target, action, model_time FROM operator_actions WHERE session_id = $1 ORDER BY model_time`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var actions []domain.ActionData
	for rows.Next() {
		var a domain.ActionData
		if err := rows.Scan(&a.Target, &a.Action, &a.ModelTime); err != nil {
			return nil, err
		}
		actions = append(actions, a)
	}
	return actions, rows.Err()
}

func (r *ReportRepo) GetAlarms(ctx context.Context, sessionID string) ([]domain.AlarmData, error) {
	rows, err := r.db.Pool.Query(ctx, `SELECT tag_id, priority, raised_model_time FROM alarm_events WHERE session_id = $1 ORDER BY raised_model_time`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var alarms []domain.AlarmData
	for rows.Next() {
		var a domain.AlarmData
		if err := rows.Scan(&a.TagID, &a.Priority, &a.ModelTime); err != nil {
			return nil, err
		}
		alarms = append(alarms, a)
	}
	return alarms, rows.Err()
}

func (r *ReportRepo) GetFaults(ctx context.Context, sessionID string) ([]domain.FaultData, error) {
	rows, err := r.db.Pool.Query(ctx, `SELECT fault_id, fired_model_time FROM fault_events WHERE session_id = $1 ORDER BY fired_model_time`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var faults []domain.FaultData
	for rows.Next() {
		var f domain.FaultData
		if err := rows.Scan(&f.FaultID, &f.ModelTime); err != nil {
			return nil, err
		}
		faults = append(faults, f)
	}
	return faults, rows.Err()
}

func (r *ReportRepo) GetSessionMeta(ctx context.Context, sessionID string) (domain.SessionData, error) {
	var d domain.SessionData
	var startedAt, stoppedAt *time.Time
	err := r.db.Pool.QueryRow(ctx, `
		SELECT s.id, s.mode, s.model_time, s.started_at, s.stopped_at,
		       sc.name
		FROM sessions s
		LEFT JOIN scenarios sc ON sc.id = s.scenario_id
		WHERE s.id = $1`, sessionID).
		Scan(&d.SessionID, &d.Mode, &d.ModelTime, &startedAt, &stoppedAt, &d.ScenarioName)
	if err != nil {
		return domain.SessionData{}, err
	}
	if startedAt != nil {
		d.StartedAt = startedAt.UTC().Format(time.RFC3339)
	}
	if stoppedAt != nil {
		d.StoppedAt = stoppedAt.UTC().Format(time.RFC3339)
	}
	return d, nil
}
