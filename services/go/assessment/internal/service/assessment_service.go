package service

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"sync"

	"github.com/itcamp/ktc/services/assessment/internal/client"
	"github.com/itcamp/ktc/services/assessment/internal/domain"
)

type AssessmentStore interface {
	GetBySession(ctx context.Context, sessionID string) (domain.Score, error)
	Upsert(ctx context.Context, s domain.Score) error
	SetVerdict(ctx context.Context, sessionID string, verdict domain.Verdict, score int) error
	SetOverride(ctx context.Context, sessionID string, score int, verdict domain.Verdict, byUserID, comment string) error
	GetReplayData(ctx context.Context, sessionID string) (domain.ReplayData, error)
	GetSessionScenarioID(ctx context.Context, sessionID string) (string, error)
}

type AssessmentService struct {
	repo   AssessmentStore
	client client.ScenarioClient
	log    *slog.Logger

	mu       sync.Mutex
	sessions map[string]*sessionState
}

type sessionState struct {
	scenario       domain.ScenarioData
	engine         *ScoringEngine
	score          domain.Score
	actionStart    float64
	completedSteps map[int]bool
	alarmTimes     map[string]float64
}

func NewAssessmentService(repo AssessmentStore, client client.ScenarioClient, log *slog.Logger) *AssessmentService {
	return &AssessmentService{
		repo: repo, client: client, log: log,
		sessions: make(map[string]*sessionState),
	}
}

func (s *AssessmentService) loadScenario(ctx context.Context, sessionID, scenarioID string) error {
	data, err := s.client.GetScenario(ctx, scenarioID)
	if err != nil {
		return err
	}
	score := domain.Score{SessionID: sessionID, Verdict: domain.VerdictPending, TotalScore: data.Criteria.MaxScore}
	hydrated := false
	if existing, err := s.repo.GetBySession(ctx, sessionID); err == nil {
		score = existing
		hydrated = true
	}

	completed := make(map[int]bool)
	if hydrated {
		completed = completedStepsFromPenalties(score.Penalties)
		if replay, err := s.repo.GetReplayData(ctx, sessionID); err == nil {
			markCompletedFromActions(completed, data.ReferenceActions, replay.Actions)
		}
	}

	state := &sessionState{
		scenario:       data,
		engine:         NewScoringEngine(data.Criteria),
		score:          score,
		completedSteps: completed,
		alarmTimes:     make(map[string]float64),
	}
	s.mu.Lock()
	s.sessions[sessionID] = state
	s.mu.Unlock()
	if !hydrated {
		IncAssessmentSessionStarted()
	}
	return nil
}

func (s *AssessmentService) ProcessEvent(ctx context.Context, event domain.AssessmentEvent, scenarioID string) error {
	s.mu.Lock()
	state, ok := s.sessions[event.SessionID]
	s.mu.Unlock()

	if !ok {
		if err := s.loadScenario(ctx, event.SessionID, scenarioID); err != nil {
			return err
		}
		s.mu.Lock()
		state = s.sessions[event.SessionID]
		s.mu.Unlock()
	}

	switch event.Type {
	case "session_start":
		state.actionStart = event.ModelTime
	case "action":
		s.processAction(ctx, state, event)
	case "alarm":
		s.processAlarm(ctx, state, event)
	case "alarm_ack":
		s.processAlarmAck(state, event)
	}
	IncAssessmentEventProcessed(event.Type)

	state.score.TotalScore = state.engine.ApplyPenalties(
		state.scenario.Criteria.MaxScore,
		state.score.Penalties,
		state.score.CriticalErrors,
	)

	return s.repo.Upsert(ctx, state.score)
}

func (s *AssessmentService) processAction(_ context.Context, state *sessionState, event domain.AssessmentEvent) {
	for _, ref := range state.scenario.ReferenceActions {
		if state.completedSteps[ref.Step] {
			continue
		}
		if matchesReference(event, ref) {
			state.completedSteps[ref.Step] = true
			_, penalty, isCritical := state.engine.ProcessAction(event, ref, state.actionStart)
			if penalty.Code != "" {
				state.score.Penalties = append(state.score.Penalties, penalty)
			}
			if isCritical {
				critErr, _ := state.engine.CheckCriticalError(event)
				state.score.CriticalErrors = append(state.score.CriticalErrors, critErr)
			}
			return
		}
	}

	critErr, isCritical := state.engine.CheckCriticalError(event)
	if isCritical {
		state.score.CriticalErrors = append(state.score.CriticalErrors, critErr)
	}
}

func (s *AssessmentService) processAlarm(_ context.Context, state *sessionState, event domain.AssessmentEvent) {
	if event.TagID != "" {
		state.alarmTimes[event.TagID] = event.ModelTime
	}
}

func (s *AssessmentService) processAlarmAck(state *sessionState, event domain.AssessmentEvent) {
	if event.TagID == "" {
		return
	}
	if alarmTime, exists := state.alarmTimes[event.TagID]; exists {
		rt := state.engine.CalculateReactionTime(alarmTime, event.ModelTime)
		rt.AlarmID = event.TagID
		state.score.ReactionTimes = append(state.score.ReactionTimes, rt)
	}
}

func (s *AssessmentService) AckAlarm(ctx context.Context, sessionID, tagID string, ackModelTime float64) {
	s.mu.Lock()
	state, ok := s.sessions[sessionID]
	s.mu.Unlock()
	if !ok {
		return
	}
	if alarmTime, exists := state.alarmTimes[tagID]; exists {
		rt := state.engine.CalculateReactionTime(alarmTime, ackModelTime)
		rt.AlarmID = tagID
		state.score.ReactionTimes = append(state.score.ReactionTimes, rt)
	}
}

func (s *AssessmentService) GetScore(ctx context.Context, sessionID string) (domain.Score, error) {
	s.mu.Lock()
	state, ok := s.sessions[sessionID]
	s.mu.Unlock()
	if ok {
		return state.score, nil
	}
	return s.repo.GetBySession(ctx, sessionID)
}

func (s *AssessmentService) Finalize(ctx context.Context, sessionID string) (domain.Score, error) {
	s.mu.Lock()
	state, ok := s.sessions[sessionID]
	s.mu.Unlock()
	if !ok {
		score, err := s.repo.GetBySession(ctx, sessionID)
		if err != nil {
			return domain.Score{}, domain.ErrScenarioNotLoaded
		}
		hasCritical := len(score.CriticalErrors) > 0
		if score.Verdict == domain.VerdictPending {
			verdict := score.Verdict
			if score.TotalScore > 0 || hasCritical {
				verdict = s.engineForSession(ctx, sessionID).CalculateVerdict(score.TotalScore, hasCritical)
			}
			score.Verdict = verdict
			_ = s.repo.SetVerdict(ctx, sessionID, verdict, score.TotalScore)
		}
		IncAssessmentSessionFinalized(string(score.Verdict))
		return score, nil
	}

	hasCritical := len(state.score.CriticalErrors) > 0
	verdict := state.engine.CalculateVerdict(state.score.TotalScore, hasCritical)
	state.score.Verdict = verdict

	if err := s.repo.SetVerdict(ctx, sessionID, verdict, state.score.TotalScore); err != nil {
		return domain.Score{}, err
	}
	IncAssessmentSessionFinalized(string(verdict))
	return state.score, nil
}

// engineForSession builds a ScoringEngine from the session's scenario criteria.
// Used when in-memory state was lost (assessment process restart).
func (s *AssessmentService) engineForSession(ctx context.Context, sessionID string) *ScoringEngine {
	scenarioID, err := s.repo.GetSessionScenarioID(ctx, sessionID)
	if err == nil && scenarioID != "" {
		if data, err := s.client.GetScenario(ctx, scenarioID); err == nil {
			return NewScoringEngine(data.Criteria)
		}
	}
	// Fail closed relative to the historical PassThreshold:1 bug (which marked
	// almost every non-zero score as pass). Prefer a typical seed threshold.
	return NewScoringEngine(domain.Criteria{PassThreshold: 70})
}

func (s *AssessmentService) Override(ctx context.Context, req domain.Override) (domain.Score, error) {
	if req.Comment == "" {
		return domain.Score{}, domain.ErrOverrideNoComment
	}
	if err := s.repo.SetOverride(ctx, req.SessionID, req.NewScore, req.Verdict, req.ByUserID, req.Comment); err != nil {
		return domain.Score{}, err
	}
	IncAssessmentOverride()
	return s.repo.GetBySession(ctx, req.SessionID)
}

func (s *AssessmentService) GetReplay(ctx context.Context, sessionID string) (domain.ReplayData, error) {
	return s.repo.GetReplayData(ctx, sessionID)
}

func (s *AssessmentService) CheckMissedSteps(ctx context.Context, sessionID string, currentModelTime float64) {
	s.mu.Lock()
	state, ok := s.sessions[sessionID]
	s.mu.Unlock()
	if !ok {
		return
	}
	changed := false
	for _, ref := range state.scenario.ReferenceActions {
		if state.completedSteps[ref.Step] {
			continue
		}
		penalty, missed := state.engine.CheckMissedAction(ref, currentModelTime, state.actionStart)
		if missed {
			state.score.Penalties = append(state.score.Penalties, penalty)
			state.completedSteps[ref.Step] = true
			changed = true
		}
	}
	if changed {
		state.score.TotalScore = state.engine.ApplyPenalties(
			state.scenario.Criteria.MaxScore,
			state.score.Penalties,
			state.score.CriticalErrors,
		)
		_ = s.repo.Upsert(ctx, state.score)
	}
}

func matchesReference(event domain.AssessmentEvent, ref domain.ReferenceAction) bool {
	if event.Target != ref.Expected.Target {
		return false
	}
	if event.Action != ref.Expected.Action {
		return false
	}
	if ref.Expected.Value != nil {
		eventValue, _ := json.Marshal(event.Value)
		expectedValue, _ := json.Marshal(ref.Expected.Value)
		if string(eventValue) != string(expectedValue) {
			return false
		}
	}
	return true
}

// completedStepsFromPenalties reconstructs which reference steps already produced
// LATE_STEP / MISSED_STEP penalties so cold-load does not double-penalize.
func completedStepsFromPenalties(penalties []domain.Penalty) map[int]bool {
	out := make(map[int]bool)
	for _, p := range penalties {
		if p.Code != "LATE_STEP" && p.Code != "MISSED_STEP" {
			continue
		}
		if step, ok := parseStepNumber(p.Description); ok {
			out[step] = true
		}
	}
	return out
}

func parseStepNumber(description string) (int, bool) {
	// Descriptions are produced by ScoringEngine: "шаг N просрочен" /
	// "обязательный шаг N пропущен".
	const marker = "шаг "
	idx := strings.Index(description, marker)
	if idx < 0 {
		return 0, false
	}
	idx += len(marker)
	if idx >= len(description) {
		return 0, false
	}
	n := 0
	found := false
	for ; idx < len(description); idx++ {
		c := description[idx]
		if c < '0' || c > '9' {
			break
		}
		found = true
		n = n*10 + int(c-'0')
	}
	return n, found
}

// markCompletedFromActions marks reference steps already performed (even when
// on-time completions left no penalty row).
func markCompletedFromActions(completed map[int]bool, refs []domain.ReferenceAction, actions []any) {
	for _, ref := range refs {
		if completed[ref.Step] {
			continue
		}
		for _, raw := range actions {
			m, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			target, _ := m["target"].(string)
			action, _ := m["action"].(string)
			if target != ref.Expected.Target || action != ref.Expected.Action {
				continue
			}
			if ref.Expected.Value != nil {
				got, _ := json.Marshal(m["value"])
				want, _ := json.Marshal(ref.Expected.Value)
				if string(got) != string(want) {
					continue
				}
			}
			completed[ref.Step] = true
			break
		}
	}
}
