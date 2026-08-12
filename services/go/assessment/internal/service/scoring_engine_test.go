package service

import (
	"testing"

	"github.com/itcamp/ktc/services/assessment/internal/domain"
)

func testCriteria() domain.Criteria {
	return domain.Criteria{
		MaxScore: 100, PenaltyLate: 10, PenaltyMiss: 25, PenaltyForbidden: 40,
		CriticalActions: []string{"esd_without_reason", "wrong_paz_override"},
		PassThreshold:   70,
	}
}

func TestScoringEngine_Verdict_Pass(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	v := e.CalculateVerdict(80, false)
	if v != domain.VerdictPass {
		t.Errorf("expected pass, got %s", v)
	}
}

func TestScoringEngine_Verdict_Fail_LowScore(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	v := e.CalculateVerdict(60, false)
	if v != domain.VerdictFail {
		t.Errorf("expected fail, got %s", v)
	}
}

func TestScoringEngine_Verdict_Fail_CriticalError(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	v := e.CalculateVerdict(90, true)
	if v != domain.VerdictFail {
		t.Errorf("expected fail with critical error, got %s", v)
	}
}

func TestScoringEngine_ApplyPenalties_NoPenalties(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	score := e.ApplyPenalties(100, nil, nil)
	if score != 100 {
		t.Errorf("expected 100, got %d", score)
	}
}

func TestScoringEngine_ApplyPenalties_LatePenalty(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	penalties := []domain.Penalty{{Code: "LATE_STEP", Points: 10}}
	score := e.ApplyPenalties(100, penalties, nil)
	if score != 90 {
		t.Errorf("expected 90, got %d", score)
	}
}

func TestScoringEngine_ApplyPenalties_MultiplePenalties(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	penalties := []domain.Penalty{
		{Code: "LATE_STEP", Points: 10},
		{Code: "MISSED_STEP", Points: 25},
	}
	score := e.ApplyPenalties(100, penalties, nil)
	if score != 65 {
		t.Errorf("expected 65, got %d", score)
	}
}

func TestScoringEngine_ApplyPenalties_CriticalError(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	critical := []domain.CriticalError{{Code: "esd_without_reason"}}
	score := e.ApplyPenalties(100, nil, critical)
	if score != 60 {
		t.Errorf("expected 60, got %d", score)
	}
}

func TestScoringEngine_ApplyPenalties_NotBelowZero(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	penalties := []domain.Penalty{
		{Points: 50}, {Points: 50}, {Points: 50},
	}
	score := e.ApplyPenalties(100, penalties, nil)
	if score != 0 {
		t.Errorf("expected 0 (clamped), got %d", score)
	}
}

func TestScoringEngine_CheckCriticalError_Detected(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	action := domain.AssessmentEvent{Action: "esd_without_reason", ModelTime: 100}
	crit, found := e.CheckCriticalError(action)
	if !found {
		t.Fatal("expected critical error")
	}
	if crit.Code != "esd_without_reason" {
		t.Errorf("expected esd_without_reason, got %s", crit.Code)
	}
}

func TestScoringEngine_CheckCriticalError_NotDetected(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	action := domain.AssessmentEvent{Action: "set_mode", ModelTime: 100}
	_, found := e.CheckCriticalError(action)
	if found {
		t.Fatal("expected no critical error")
	}
}

func TestScoringEngine_CalculateReactionTime(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	rt := e.CalculateReactionTime(100.0, 108.5)
	if rt.Seconds != 8.5 {
		t.Errorf("expected 8.5, got %f", rt.Seconds)
	}
}

func TestScoringEngine_ProcessAction_OnTime(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	ref := domain.ReferenceAction{Step: 1, DeadlineSeconds: 30, Mandatory: true}
	action := domain.AssessmentEvent{ModelTime: 110}
	_, penalty, _ := e.ProcessAction(action, ref, 100)
	if penalty.Code != "" {
		t.Errorf("expected no penalty for on-time action, got %s", penalty.Code)
	}
}

func TestScoringEngine_ProcessAction_Late(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	ref := domain.ReferenceAction{Step: 1, DeadlineSeconds: 30, Mandatory: true}
	action := domain.AssessmentEvent{ModelTime: 140}
	_, penalty, _ := e.ProcessAction(action, ref, 100)
	if penalty.Code != "LATE_STEP" {
		t.Errorf("expected LATE_STEP, got %s", penalty.Code)
	}
	if penalty.Points != 10 {
		t.Errorf("expected 10 points, got %d", penalty.Points)
	}
}

func TestScoringEngine_CheckMissedAction_MandatoryMissed(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	ref := domain.ReferenceAction{Step: 1, DeadlineSeconds: 30, Mandatory: true}
	penalty, missed := e.CheckMissedAction(ref, 140, 100)
	if !missed {
		t.Fatal("expected missed")
	}
	if penalty.Code != "MISSED_STEP" {
		t.Errorf("expected MISSED_STEP, got %s", penalty.Code)
	}
}

func TestScoringEngine_CheckMissedAction_NotMandatory(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	ref := domain.ReferenceAction{Step: 1, DeadlineSeconds: 30, Mandatory: false}
	_, missed := e.CheckMissedAction(ref, 140, 100)
	if missed {
		t.Fatal("expected not missed for non-mandatory")
	}
}

func TestScoringEngine_CheckMissedAction_StillInTime(t *testing.T) {
	e := NewScoringEngine(testCriteria())
	ref := domain.ReferenceAction{Step: 1, DeadlineSeconds: 30, Mandatory: true}
	_, missed := e.CheckMissedAction(ref, 120, 100)
	if missed {
		t.Fatal("expected not missed (still in time)")
	}
}

func TestMatchesReference_Match(t *testing.T) {
	event := domain.AssessmentEvent{Target: "TRC-3", Action: "decrease"}
	ref := domain.ReferenceAction{Expected: domain.ExpectedAction{Target: "TRC-3", Action: "decrease"}}
	if !matchesReference(event, ref) {
		t.Error("expected match")
	}
}

func TestMatchesReference_NoMatch_Target(t *testing.T) {
	event := domain.AssessmentEvent{Target: "TRC-5", Action: "decrease"}
	ref := domain.ReferenceAction{Expected: domain.ExpectedAction{Target: "TRC-3", Action: "decrease"}}
	if matchesReference(event, ref) {
		t.Error("expected no match (different target)")
	}
}

func TestMatchesReference_NoMatch_Action(t *testing.T) {
	event := domain.AssessmentEvent{Target: "TRC-3", Action: "increase"}
	ref := domain.ReferenceAction{Expected: domain.ExpectedAction{Target: "TRC-3", Action: "decrease"}}
	if matchesReference(event, ref) {
		t.Error("expected no match (different action)")
	}
}

func TestMatchesReference_TagNormalization(t *testing.T) {
	ref := domain.ReferenceAction{Expected: domain.ExpectedAction{Target: "LRCA-641", Action: "set_mode", Value: "MANUAL"}}
	event := domain.AssessmentEvent{Target: "LRCA 641", Action: "set_mode", Value: "MANUAL"}
	if !matchesReference(event, ref) {
		t.Fatal("expected hyphen/space tag forms to match")
	}
}

func TestMatchesReference_ModeValueEquivalence(t *testing.T) {
	ref := domain.ReferenceAction{Expected: domain.ExpectedAction{Target: "LRCA-641", Action: "set_mode", Value: "MANUAL"}}
	event := domain.AssessmentEvent{Target: "LRCA-641", Action: "set_mode", Value: 1.0}
	if !matchesReference(event, ref) {
		t.Fatal("expected numeric MANUAL (1.0) to match string MANUAL")
	}
	eventAuto := domain.AssessmentEvent{Target: "LRCA-641", Action: "set_mode", Value: 0.0}
	if matchesReference(eventAuto, ref) {
		t.Fatal("AUTO (0.0) must not match MANUAL")
	}
}

func TestMatchesReference_ActionCaseInsensitive(t *testing.T) {
	ref := domain.ReferenceAction{Expected: domain.ExpectedAction{Target: "TRC-3", Action: "decrease"}}
	event := domain.AssessmentEvent{Target: "trc-3", Action: "Decrease"}
	if !matchesReference(event, ref) {
		t.Fatal("expected case-insensitive action/target match")
	}
}
