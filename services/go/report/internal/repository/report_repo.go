package repository

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/itcamp/ktc/services/report/internal/domain"
)

type ReportRepo struct {
	db *Postgres
}

func NewReportRepo(pg *Postgres) *ReportRepo {
	return &ReportRepo{db: pg}
}

const reportCols = `id, session_id, type, status, canonical_json, storage_key, error, created_at, updated_at`

func (r *ReportRepo) scanReport(row pgx.Row) (domain.Report, error) {
	var rep domain.Report
	if err := row.Scan(&rep.ID, &rep.SessionID, &rep.Type, &rep.Status, &rep.CanonicalJSON, &rep.StorageKey, &rep.Error, &rep.CreatedAt, &rep.UpdatedAt); err != nil {
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

type ScoreData struct {
	TotalScore     int                  `json:"total_score"`
	Verdict        string               `json:"verdict"`
	Penalties      []domain.PenaltyData `json:"penalties"`
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
	json.Unmarshal(penaltiesJSON, &s.Penalties)
	json.Unmarshal(criticalJSON, &s.CriticalErrors)
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
		rows.Scan(&a.Target, &a.Action, &a.ModelTime)
		actions = append(actions, a)
	}
	return actions, nil
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
		rows.Scan(&a.TagID, &a.Priority, &a.ModelTime)
		alarms = append(alarms, a)
	}
	return alarms, nil
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
		rows.Scan(&f.FaultID, &f.ModelTime)
		faults = append(faults, f)
	}
	return faults, nil
}
