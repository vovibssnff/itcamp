package service

import (
	"context"
	"log/slog"
	"os"
	"sync"
	"testing"

	"github.com/itcamp/ktc/services/assessment/internal/domain"
)

var testLog = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))

type mockAssessmentStore struct {
	mu     sync.Mutex
	scores map[string]domain.Score
}

func newMockAssessmentStore() *mockAssessmentStore {
	return &mockAssessmentStore{scores: make(map[string]domain.Score)}
}

func (m *mockAssessmentStore) GetBySession(_ context.Context, sessionID string) (domain.Score, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.scores[sessionID]
	if !ok {
		return domain.Score{}, domain.ErrAssessmentNotFound
	}
	return s, nil
}

func (m *mockAssessmentStore) Upsert(_ context.Context, s domain.Score) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.scores[s.SessionID] = s
	return nil
}

func (m *mockAssessmentStore) SetVerdict(_ context.Context, sessionID string, verdict domain.Verdict, score int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s, ok := m.scores[sessionID]; ok {
		s.Verdict = verdict
		s.TotalScore = score
		m.scores[sessionID] = s
	}
	return nil
}

func (m *mockAssessmentStore) SetOverride(_ context.Context, sessionID string, score int, verdict domain.Verdict, _, _ string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s, ok := m.scores[sessionID]; ok {
		s.TotalScore = score
		s.Verdict = verdict
		m.scores[sessionID] = s
	}
	return nil
}

func (m *mockAssessmentStore) GetReplayData(_ context.Context, _ string) (domain.ReplayData, error) {
	return domain.ReplayData{}, nil
}

type mockScenarioClient struct {
	data map[string]domain.ScenarioData
}

func newMockScenarioClient() *mockScenarioClient {
	return &mockScenarioClient{data: make(map[string]domain.ScenarioData)}
}

func (m *mockScenarioClient) GetScenario(_ context.Context, scenarioID string) (domain.ScenarioData, error) {
	d, ok := m.data[scenarioID]
	if !ok {
		return domain.ScenarioData{}, domain.ErrScenarioNotLoaded
	}
	return d, nil
}

func testAssessmentService() (*AssessmentService, *mockScenarioClient, *mockAssessmentStore) {
	client := newMockScenarioClient()
	store := newMockAssessmentStore()
	svc := NewAssessmentService(store, client, testLog)
	return svc, client, store
}

func testScenarioData() domain.ScenarioData {
	return domain.ScenarioData{
		ReferenceActions: []domain.ReferenceAction{
			{Step: 1, Description: "Decrease fuel", Expected: domain.ExpectedAction{Target: "TRC-3", Action: "decrease"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 2, Description: "Check pump", Expected: domain.ExpectedAction{Target: "PUMP-N1", Action: "check"}, DeadlineSeconds: 60, Mandatory: true},
		},
		Criteria: testCriteria(),
	}
}

func TestAssessmentService_ProcessEvent_Action(t *testing.T) {
	svc, client, _ := testAssessmentService()
	client.data["sc-1"] = testScenarioData()

	err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "action", Target: "TRC-3", Action: "decrease", ModelTime: 110,
	}, "sc-1")
	if err != nil {
		t.Fatalf("process event failed: %v", err)
	}

	score, _ := svc.GetScore(context.Background(), "sess-1")
	if score.SessionID != "sess-1" {
		t.Error("expected score for sess-1")
	}
}

func TestAssessmentService_ProcessEvent_Alarm(t *testing.T) {
	svc, client, _ := testAssessmentService()
	client.data["sc-1"] = testScenarioData()

	err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "alarm", TagID: "PRSA-204", Priority: "H", ModelTime: 100,
	}, "sc-1")
	if err != nil {
		t.Fatalf("process alarm failed: %v", err)
	}
}

func TestAssessmentService_ProcessEvent_CriticalAction(t *testing.T) {
	svc, client, _ := testAssessmentService()
	client.data["sc-1"] = testScenarioData()

	err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "action", Action: "esd_without_reason", ModelTime: 200,
	}, "sc-1")
	if err != nil {
		t.Fatalf("process event failed: %v", err)
	}

	score, _ := svc.GetScore(context.Background(), "sess-1")
	if len(score.CriticalErrors) == 0 {
		t.Error("expected critical error recorded")
	}
}

func TestAssessmentService_Finalize(t *testing.T) {
	svc, client, _ := testAssessmentService()
	client.data["sc-1"] = testScenarioData()

	if err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "action", Target: "TRC-3", Action: "decrease", ModelTime: 110,
	}, "sc-1"); err != nil {
		t.Fatalf("process event failed: %v", err)
	}

	score, err := svc.Finalize(context.Background(), "sess-1")
	if err != nil {
		t.Fatalf("finalize failed: %v", err)
	}
	if score.Verdict != domain.VerdictPass && score.Verdict != domain.VerdictFail {
		t.Errorf("expected pass or fail, got %s", score.Verdict)
	}
}

func TestAssessmentService_Finalize_NotLoaded(t *testing.T) {
	svc, _, _ := testAssessmentService()
	_, err := svc.Finalize(context.Background(), "unknown-session")
	if err == nil {
		t.Fatal("expected error for unloaded session")
	}
}

func TestAssessmentService_AckAlarm(t *testing.T) {
	svc, client, _ := testAssessmentService()
	client.data["sc-1"] = testScenarioData()

	if err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "alarm", TagID: "PRSA-204", Priority: "H", ModelTime: 100,
	}, "sc-1"); err != nil {
		t.Fatalf("process event failed: %v", err)
	}

	svc.AckAlarm(context.Background(), "sess-1", "PRSA-204", 108.5)

	score, _ := svc.GetScore(context.Background(), "sess-1")
	if len(score.ReactionTimes) == 0 {
		t.Error("expected reaction time recorded")
	}
	if score.ReactionTimes[0].Seconds != 8.5 {
		t.Errorf("expected 8.5s, got %f", score.ReactionTimes[0].Seconds)
	}
}

func TestAssessmentService_CheckMissedSteps(t *testing.T) {
	svc, client, store := testAssessmentService()
	client.data["sc-1"] = testScenarioData()

	if err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "session_start", ModelTime: 100,
	}, "sc-1"); err != nil {
		t.Fatalf("session_start failed: %v", err)
	}
	if err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "action", Target: "TRC-3", Action: "decrease", ModelTime: 110,
	}, "sc-1"); err != nil {
		t.Fatalf("process event failed: %v", err)
	}

	svc.CheckMissedSteps(context.Background(), "sess-1", 200)

	score, _ := svc.GetScore(context.Background(), "sess-1")
	found := false
	for _, p := range score.Penalties {
		if p.Code == "MISSED_STEP" {
			found = true
		}
	}
	if !found {
		t.Error("expected missed step penalty for step 2")
	}
	want := testCriteria().MaxScore - testCriteria().PenaltyMiss
	if score.TotalScore != want {
		t.Errorf("expected total score %d, got %d", want, score.TotalScore)
	}
	persisted, err := store.GetBySession(context.Background(), "sess-1")
	if err != nil {
		t.Fatalf("expected missed steps to be upserted: %v", err)
	}
	if persisted.TotalScore != score.TotalScore {
		t.Errorf("persisted score %d != in-memory %d", persisted.TotalScore, score.TotalScore)
	}
}

// Concurrent ProcessEvent + CheckMissedSteps must not lose penalties or panic on map/slice races.
func TestAssessmentService_ProcessEvent_CheckMissed_NoRace(t *testing.T) {
	svc, client, store := testAssessmentService()
	client.data["sc-1"] = testScenarioData()

	if err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-race", Type: "session_start", ModelTime: 0,
	}, "sc-1"); err != nil {
		t.Fatalf("session_start failed: %v", err)
	}

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(2)
		go func(n int) {
			defer wg.Done()
			_ = svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
				SessionID: "sess-race",
				Type:      "action",
				Target:    "TRC-3",
				Action:    "decrease",
				ModelTime: float64(10 + n),
			}, "sc-1")
		}(i)
		go func(n int) {
			defer wg.Done()
			svc.CheckMissedSteps(context.Background(), "sess-race", float64(100+n))
		}(i)
	}
	wg.Wait()

	score, err := svc.GetScore(context.Background(), "sess-race")
	if err != nil {
		t.Fatalf("get score: %v", err)
	}
	persisted, err := store.GetBySession(context.Background(), "sess-race")
	if err != nil {
		t.Fatalf("persisted score missing: %v", err)
	}
	if score.TotalScore != persisted.TotalScore {
		t.Errorf("in-memory total %d != persisted %d", score.TotalScore, persisted.TotalScore)
	}
	if len(score.Penalties) != len(persisted.Penalties) {
		t.Errorf("in-memory penalties %d != persisted %d", len(score.Penalties), len(persisted.Penalties))
	}
}
