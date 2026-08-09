package service

import (
	"context"
	"log/slog"
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
	state := &sessionState{
		scenario:       data,
		engine:         NewScoringEngine(data.Criteria),
		score:          domain.Score{SessionID: sessionID, Verdict: domain.VerdictPending, TotalScore: data.Criteria.MaxScore},
		completedSteps: make(map[int]bool),
		alarmTimes:     make(map[string]float64),
	}
	s.mu.Lock()
	s.sessions[sessionID] = state
	s.mu.Unlock()
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
	case "action":
		s.processAction(ctx, state, event)
	case "alarm":
		s.processAlarm(ctx, state, event)
	}

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
		return domain.Score{}, domain.ErrScenarioNotLoaded
	}

	hasCritical := len(state.score.CriticalErrors) > 0
	verdict := state.engine.CalculateVerdict(state.score.TotalScore, hasCritical)
	state.score.Verdict = verdict

	if err := s.repo.SetVerdict(ctx, sessionID, verdict, state.score.TotalScore); err != nil {
		return domain.Score{}, err
	}
	return state.score, nil
}

func (s *AssessmentService) Override(ctx context.Context, req domain.Override) (domain.Score, error) {
	if req.Comment == "" {
		return domain.Score{}, domain.ErrOverrideNoComment
	}
	if err := s.repo.SetOverride(ctx, req.SessionID, req.NewScore, req.Verdict, req.ByUserID, req.Comment); err != nil {
		return domain.Score{}, err
	}
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
	for _, ref := range state.scenario.ReferenceActions {
		if state.completedSteps[ref.Step] {
			continue
		}
		penalty, missed := state.engine.CheckMissedAction(ref, currentModelTime, state.actionStart)
		if missed {
			state.score.Penalties = append(state.score.Penalties, penalty)
			state.completedSteps[ref.Step] = true
		}
	}
}

func matchesReference(event domain.AssessmentEvent, ref domain.ReferenceAction) bool {
	if event.Target != ref.Expected.Target {
		return false
	}
	if event.Action != ref.Expected.Action {
		return false
	}
	return true
}
