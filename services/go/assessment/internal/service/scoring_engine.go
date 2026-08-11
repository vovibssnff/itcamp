package service

import (
	"github.com/itcamp/ktc/services/assessment/internal/domain"
)

type ScoringEngine struct {
	criteria domain.Criteria
}

func NewScoringEngine(criteria domain.Criteria) *ScoringEngine {
	return &ScoringEngine{criteria: criteria}
}

func (e *ScoringEngine) ProcessAction(action domain.AssessmentEvent, ref domain.ReferenceAction, actionStartTime float64) (domain.Score, domain.Penalty, bool) {
	score := domain.Score{SessionID: action.SessionID}
	var penalty domain.Penalty
	isCritical := false

	if ref.Step == 0 {
		return score, penalty, false
	}

	elapsed := action.ModelTime - actionStartTime
	if elapsed > float64(ref.DeadlineSeconds) {
		penalty = domain.Penalty{
			Code:        "LATE_STEP",
			Description: "шаг " + itoa(ref.Step) + " просрочен",
			Points:      e.criteria.PenaltyLate,
			ModelTime:   action.ModelTime,
		}
	}

	if e.isForbiddenAction(action, ref) {
		isCritical = true
	}

	return score, penalty, isCritical
}

func (e *ScoringEngine) CheckMissedAction(ref domain.ReferenceAction, currentModelTime float64, actionStartTime float64) (domain.Penalty, bool) {
	if !ref.Mandatory {
		return domain.Penalty{}, false
	}
	deadline := actionStartTime + float64(ref.DeadlineSeconds)
	if currentModelTime > deadline {
		return domain.Penalty{
			Code:        "MISSED_STEP",
			Description: "обязательный шаг " + itoa(ref.Step) + " пропущен",
			Points:      e.criteria.PenaltyMiss,
			ModelTime:   currentModelTime,
		}, true
	}
	return domain.Penalty{}, false
}

func (e *ScoringEngine) CalculateReactionTime(alarmModelTime float64, ackModelTime float64) domain.ReactionTime {
	return domain.ReactionTime{
		AlarmID: "",
		Seconds: ackModelTime - alarmModelTime,
	}
}

func (e *ScoringEngine) CheckCriticalError(action domain.AssessmentEvent) (domain.CriticalError, bool) {
	for _, critical := range e.criteria.CriticalActions {
		if action.Action == critical || action.Target == critical {
			return domain.CriticalError{
				Code:        critical,
				Description: "критическая ошибка: " + critical,
				ModelTime:   action.ModelTime,
			}, true
		}
	}
	return domain.CriticalError{}, false
}

func (e *ScoringEngine) CalculateVerdict(totalScore int, hasCriticalErrors bool) domain.Verdict {
	if hasCriticalErrors {
		return domain.VerdictFail
	}
	if totalScore >= e.criteria.PassThreshold {
		return domain.VerdictPass
	}
	return domain.VerdictFail
}

func (e *ScoringEngine) ApplyPenalties(maxScore int, penalties []domain.Penalty, criticalErrors []domain.CriticalError) int {
	score := maxScore
	for _, p := range penalties {
		score -= p.Points
	}
	for range criticalErrors {
		score -= e.criteria.PenaltyForbidden
	}
	if score < 0 {
		score = 0
	}
	return score
}

func (e *ScoringEngine) isForbiddenAction(action domain.AssessmentEvent, ref domain.ReferenceAction) bool {
	for _, critical := range e.criteria.CriticalActions {
		if action.Action == critical || action.Target == critical {
			return true
		}
	}
	return false
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [10]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
