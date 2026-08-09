package repository

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

type SessionRepo struct {
	db *Postgres
}

func NewSessionRepo(pg *Postgres) *SessionRepo {
	return &SessionRepo{db: pg}
}

const sessionCols = `id, template_id, scenario_id, operator_ids, instructor_id, mode, speed, status, model_time, started_at, stopped_at, created_at`

func (r *SessionRepo) scanSession(row pgx.Row) (domain.Session, error) {
	var s domain.Session
	var operatorsJSON []byte
	if err := row.Scan(&s.ID, &s.TemplateID, &s.ScenarioID, &operatorsJSON, &s.InstructorID, &s.Mode, &s.Speed, &s.Status, &s.ModelTime, &s.StartedAt, &s.StoppedAt, &s.CreatedAt); err != nil {
		return domain.Session{}, err
	}
	json.Unmarshal(operatorsJSON, &s.OperatorIDs)
	return s, nil
}

func (r *SessionRepo) GetByID(ctx context.Context, id string) (domain.Session, error) {
	row := r.db.Pool.QueryRow(ctx, `SELECT `+sessionCols+` FROM sessions WHERE id = $1`, id)
	s, err := r.scanSession(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Session{}, domain.ErrSessionNotFound
	}
	return s, err
}

func (r *SessionRepo) List(ctx context.Context, status, operatorID string) ([]domain.Session, error) {
	q := `SELECT ` + sessionCols + ` FROM sessions`
	args := []any{}
	cond := ""
	if status != "" {
		cond = " WHERE status = $1"
		args = append(args, status)
	}
	q += cond + " ORDER BY created_at DESC"
	rows, err := r.db.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var sessions []domain.Session
	for rows.Next() {
		s, err := r.scanSession(rows)
		if err != nil {
			return nil, err
		}
		if operatorID != "" {
			found := false
			for _, op := range s.OperatorIDs {
				if op == operatorID {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		sessions = append(sessions, s)
	}
	return sessions, rows.Err()
}

func (r *SessionRepo) Create(ctx context.Context, s domain.Session) error {
	operatorsJSON, _ := json.Marshal(s.OperatorIDs)
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO sessions (id, template_id, scenario_id, operator_ids, instructor_id, mode, speed, status, model_time, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
		s.ID, s.TemplateID, s.ScenarioID, operatorsJSON, s.InstructorID, string(s.Mode), s.Speed, string(s.Status), s.ModelTime)
	return err
}

func (r *SessionRepo) UpdateStatus(ctx context.Context, id string, status domain.SessionStatus, modelTime float64) error {
	var stoppedAt *time.Time
	if status == domain.StatusStopped || status == domain.StatusFinished {
		now := time.Now()
		stoppedAt = &now
	}
	tag, err := r.db.Pool.Exec(ctx, `UPDATE sessions SET status = $2, model_time = $3, stopped_at = COALESCE($4, stopped_at) WHERE id = $1`,
		id, string(status), modelTime, stoppedAt)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrSessionNotFound
	}
	return nil
}

func (r *SessionRepo) SetStarted(ctx context.Context, id string) error {
	now := time.Now()
	tag, err := r.db.Pool.Exec(ctx, `UPDATE sessions SET status = 'running', started_at = $2 WHERE id = $1`,
		id, now)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrSessionNotFound
	}
	return nil
}

func (r *SessionRepo) UpdateSpeed(ctx context.Context, id string, speed float64) error {
	tag, err := r.db.Pool.Exec(ctx, `UPDATE sessions SET speed = $2 WHERE id = $1`, id, speed)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrSessionNotFound
	}
	return nil
}

func (r *SessionRepo) RecordAction(ctx context.Context, a domain.OperatorAction) error {
	valueJSON, _ := json.Marshal(a.Value)
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO operator_actions (id, session_id, user_id, type, target, action, value, model_time, server_time)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		a.ID, a.SessionID, a.UserID, a.Type, a.Target, a.Action, valueJSON, a.ModelTime, a.ServerTime)
	return err
}

func (r *SessionRepo) RecordFaultEvent(ctx context.Context, f domain.FaultEvent) error {
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO fault_events (id, session_id, fault_id, component_instance_id, trigger_type, fired_model_time)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		f.ID, f.SessionID, f.FaultID, f.ComponentID, f.TriggerType, f.FiredModelTime)
	return err
}

func (r *SessionRepo) RecordAlarm(ctx context.Context, a domain.AlarmEvent) error {
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO alarm_events (id, session_id, tag_id, priority, raised_model_time)
		VALUES ($1, $2, $3, $4, $5)`,
		a.ID, a.SessionID, a.TagID, a.Priority, a.RaisedModelTime)
	return err
}

func (r *SessionRepo) AckAlarm(ctx context.Context, alarmID string, modelTime float64, userID string) error {
	_, err := r.db.Pool.Exec(ctx, `UPDATE alarm_events SET ack_model_time = $2, ack_user_id = $3 WHERE id = $1`,
		alarmID, modelTime, userID)
	return err
}
