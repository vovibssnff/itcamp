package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/itcamp/ktc/services/assessment/internal/domain"
	"github.com/itcamp/ktc/services/assessment/internal/service"
)

type stubStore struct {
	scores  map[string]domain.Score
	members map[string]map[string]bool // sessionID → userID → ok
}

func (s *stubStore) GetBySession(_ context.Context, sessionID string) (domain.Score, error) {
	sc, ok := s.scores[sessionID]
	if !ok {
		return domain.Score{}, domain.ErrAssessmentNotFound
	}
	return sc, nil
}

func (s *stubStore) Upsert(_ context.Context, sc domain.Score) error {
	s.scores[sc.SessionID] = sc
	return nil
}

func (s *stubStore) SetVerdict(_ context.Context, sessionID string, verdict domain.Verdict, score int) error {
	sc := s.scores[sessionID]
	sc.Verdict = verdict
	sc.TotalScore = score
	s.scores[sessionID] = sc
	return nil
}

func (s *stubStore) SetOverride(_ context.Context, sessionID string, score int, verdict domain.Verdict, _, _ string) error {
	sc := s.scores[sessionID]
	sc.TotalScore = score
	sc.Verdict = verdict
	s.scores[sessionID] = sc
	return nil
}

func (s *stubStore) GetReplayData(_ context.Context, sessionID string) (domain.ReplayData, error) {
	if _, ok := s.scores[sessionID]; !ok {
		return domain.ReplayData{}, nil
	}
	return domain.ReplayData{Actions: []any{map[string]any{"type": "action"}}}, nil
}

func (s *stubStore) UserCanAccessSession(_ context.Context, sessionID, userID string) (bool, error) {
	if s.members == nil {
		return false, nil
	}
	return s.members[sessionID][userID], nil
}

type stubScenario struct{}

func (stubScenario) GetScenario(_ context.Context, _ string) (domain.ScenarioData, error) {
	return domain.ScenarioData{
		Criteria: domain.Criteria{MaxScore: 100, PassThreshold: 60},
	}, nil
}

func newAuthzFixture() (*AssessmentHandler, *stubStore) {
	store := &stubStore{
		scores: map[string]domain.Score{
			"sess-1": {SessionID: "sess-1", TotalScore: 80, Verdict: domain.VerdictPass},
		},
		members: map[string]map[string]bool{
			"sess-1": {"op-1": true},
		},
	}
	svc := service.NewAssessmentService(store, stubScenario{}, slog.Default())
	return NewAssessmentHandler(svc), store
}

func TestRejectUserFacingInternal(t *testing.T) {
	t.Parallel()
	req := httptest.NewRequest(http.MethodPost, "/assessment/event", nil)
	if err := rejectUserFacingInternal(req); err != nil {
		t.Fatalf("S2S (no X-User-ID) must be allowed: %v", err)
	}
	req.Header.Set("X-User-ID", "op-1")
	if !errors.Is(rejectUserFacingInternal(req), domain.ErrForbidden) {
		t.Fatal("user-facing call must be forbidden")
	}
}

func TestEvent_RejectsAuthenticatedCaller(t *testing.T) {
	h, store := newAuthzFixture()
	body := []byte(`{"session_id":"sess-1","type":"action","target":"TRC-3","action":"decrease","model_time":1}`)
	req := httptest.NewRequest(http.MethodPost, "/assessment/event?scenario_id=sc-1", bytes.NewReader(body))
	req.Header.Set("X-User-ID", "op-1")
	req.Header.Set("X-Roles", "operator")
	rec := httptest.NewRecorder()
	h.Event(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
	if _, ok := store.scores["sess-forged"]; ok {
		t.Fatal("must not persist forged score state")
	}
}

func TestEvent_AllowsServiceToService(t *testing.T) {
	h, _ := newAuthzFixture()
	body := []byte(`{"session_id":"sess-new","type":"session_start","model_time":0}`)
	req := httptest.NewRequest(http.MethodPost, "/assessment/event?scenario_id=sc-1", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.Event(rec, req)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202; body=%s", rec.Code, rec.Body.String())
	}
}

func TestResult_RejectsAuthenticatedCaller(t *testing.T) {
	h, _ := newAuthzFixture()
	req := httptest.NewRequest(http.MethodPost, "/assessment/session/sess-1/result", nil)
	req.SetPathValue("id", "sess-1")
	req.Header.Set("X-User-ID", "op-1")
	req.Header.Set("X-Roles", "operator")
	rec := httptest.NewRecorder()
	h.Result(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}

func TestScore_OperatorPeerDenied(t *testing.T) {
	h, _ := newAuthzFixture()
	req := httptest.NewRequest(http.MethodGet, "/assessment/session/sess-1/score", nil)
	req.SetPathValue("id", "sess-1")
	req.Header.Set("X-User-ID", "op-other")
	req.Header.Set("X-Roles", "operator")
	rec := httptest.NewRecorder()
	h.Score(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}

func TestScore_OperatorMemberAllowed(t *testing.T) {
	h, _ := newAuthzFixture()
	req := httptest.NewRequest(http.MethodGet, "/assessment/session/sess-1/score", nil)
	req.SetPathValue("id", "sess-1")
	req.Header.Set("X-User-ID", "op-1")
	req.Header.Set("X-Roles", "operator")
	rec := httptest.NewRecorder()
	h.Score(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	var got domain.Score
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got.TotalScore != 80 {
		t.Fatalf("score = %d, want 80", got.TotalScore)
	}
}

func TestScore_InstructorBypass(t *testing.T) {
	h, _ := newAuthzFixture()
	req := httptest.NewRequest(http.MethodGet, "/assessment/session/sess-1/score", nil)
	req.SetPathValue("id", "sess-1")
	req.Header.Set("X-User-ID", "inst-1")
	req.Header.Set("X-Roles", "instructor")
	rec := httptest.NewRecorder()
	h.Score(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestReplay_OperatorPeerDenied(t *testing.T) {
	h, _ := newAuthzFixture()
	req := httptest.NewRequest(http.MethodGet, "/assessment/session/sess-1/replay", nil)
	req.SetPathValue("id", "sess-1")
	req.Header.Set("X-User-ID", "op-other")
	req.Header.Set("X-Roles", "operator")
	rec := httptest.NewRecorder()
	h.Replay(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}

func TestMapErrorForbidden(t *testing.T) {
	t.Parallel()
	status, code := mapError(domain.ErrForbidden)
	if status != http.StatusForbidden || code != "forbidden" {
		t.Fatalf("got %d %q, want 403 forbidden", status, code)
	}
}
