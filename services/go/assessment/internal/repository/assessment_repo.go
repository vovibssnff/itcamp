package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/itcamp/ktc/shared/go/ktccatalog"
	"github.com/itcamp/ktc/services/assessment/internal/domain"
)

type AssessmentRepo struct {
	db *Postgres
}

func NewAssessmentRepo(pg *Postgres) *AssessmentRepo {
	return &AssessmentRepo{db: pg}
}

func (r *AssessmentRepo) GetBySession(ctx context.Context, sessionID string) (domain.Score, error) {
	var s domain.Score
	var penaltiesJSON, criticalJSON, reactionJSON []byte
	err := r.db.Pool.QueryRow(ctx, `
		SELECT session_id, reaction_times, penalties, critical_errors, total_score, verdict
		FROM assessments WHERE session_id = $1`, sessionID).
		Scan(&s.SessionID, &reactionJSON, &penaltiesJSON, &criticalJSON, &s.TotalScore, &s.Verdict)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Score{}, domain.ErrAssessmentNotFound
		}
		return domain.Score{}, err
	}
	if err := json.Unmarshal(penaltiesJSON, &s.Penalties); err != nil {
		return domain.Score{}, fmt.Errorf("unmarshal penalties: %w", err)
	}
	if err := json.Unmarshal(criticalJSON, &s.CriticalErrors); err != nil {
		return domain.Score{}, fmt.Errorf("unmarshal critical_errors: %w", err)
	}
	if err := json.Unmarshal(reactionJSON, &s.ReactionTimes); err != nil {
		return domain.Score{}, fmt.Errorf("unmarshal reaction_times: %w", err)
	}
	return s, nil
}

func (r *AssessmentRepo) Upsert(ctx context.Context, s domain.Score) error {
	penaltiesJSON, _ := json.Marshal(s.Penalties)
	criticalJSON, _ := json.Marshal(s.CriticalErrors)
	reactionJSON, _ := json.Marshal(s.ReactionTimes)
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO assessments (id, session_id, penalties, critical_errors, reaction_times, total_score, verdict, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
		ON CONFLICT (session_id) DO UPDATE SET penalties = $3, critical_errors = $4, reaction_times = $5, total_score = $6, verdict = $7, updated_at = now()`,
		newUUID(), s.SessionID, penaltiesJSON, criticalJSON, reactionJSON, s.TotalScore, string(s.Verdict))
	return err
}

func (r *AssessmentRepo) SetVerdict(ctx context.Context, sessionID string, verdict domain.Verdict, score int) error {
	tag, err := r.db.Pool.Exec(ctx, `UPDATE assessments SET verdict = $2, total_score = $3, updated_at = now() WHERE session_id = $1`,
		sessionID, string(verdict), score)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrAssessmentNotFound
	}
	return nil
}

func (r *AssessmentRepo) SetOverride(ctx context.Context, sessionID string, score int, verdict domain.Verdict, byUserID, comment string) error {
	tag, err := r.db.Pool.Exec(ctx, `UPDATE assessments SET total_score = $2, verdict = $3, override_by = $4, override_comment = $5, updated_at = now() WHERE session_id = $1`,
		sessionID, score, string(verdict), byUserID, comment)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrAssessmentNotFound
	}
	_, err = r.db.Pool.Exec(ctx, `
		INSERT INTO assessment_overrides (session_id, old_score, new_score, old_verdict, new_verdict, comment, by_user_id)
		VALUES ($1, 0, $2, 'pending', $3, $4, $5)`,
		sessionID, score, string(verdict), comment, byUserID)
	return err
}

func (r *AssessmentRepo) GetReplayData(ctx context.Context, sessionID string) (domain.ReplayData, error) {
	var replay domain.ReplayData

	rows, err := r.db.Pool.Query(ctx, `
		SELECT type, target, action, value, model_time FROM operator_actions WHERE session_id = $1 ORDER BY model_time`, sessionID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var t, target, action string
			var valueJSON []byte
			var mt float64
			if err := rows.Scan(&t, &target, &action, &valueJSON, &mt); err != nil {
				return domain.ReplayData{}, err
			}
			replay.Actions = append(replay.Actions, map[string]any{"type": t, "target": target, "action": action, "model_time": mt})		}
	}

	rows2, err := r.db.Pool.Query(ctx, `
		SELECT tag_id, priority, raised_model_time FROM alarm_events WHERE session_id = $1 ORDER BY raised_model_time`, sessionID)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var tagID, priority string
			var mt float64
			if err := rows2.Scan(&tagID, &priority, &mt); err != nil {
				return domain.ReplayData{}, err
			}
			replay.Alarms = append(replay.Alarms, map[string]any{
				"tag_id": tagID, "priority": priority, "model_time": mt,
				"description": ktccatalog.TagDescriptionOf(tagID),
			})
		}
	}

	rows3, err := r.db.Pool.Query(ctx, `
		SELECT fault_id, component_instance_id, fired_model_time FROM fault_events WHERE session_id = $1 ORDER BY fired_model_time`, sessionID)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var faultID, compID string
			var mt float64
			if err := rows3.Scan(&faultID, &compID, &mt); err != nil {
				return domain.ReplayData{}, err
			}
			replay.Faults = append(replay.Faults, map[string]any{
				"fault_id": faultID, "component": compID, "model_time": mt,
				"description": ktccatalog.FaultDescription(faultID),
			})
		}
	}

	return replay, nil
}
