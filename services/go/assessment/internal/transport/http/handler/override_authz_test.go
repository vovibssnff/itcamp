package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/itcamp/ktc/services/assessment/internal/domain"
	"github.com/itcamp/ktc/services/assessment/internal/service"
)

type stubStore struct {
	scores map[string]domain.Score
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

func (s *stubStore) GetReplayData(_ context.Context, _ string) (domain.ReplayData, error) {
	return domain.ReplayData{}, nil
}

type stubScenario struct{}

func (stubScenario) GetScenario(_ context.Context, _ string) (domain.ScenarioData, error) {
	return domain.ScenarioData{}, domain.ErrScenarioNotFound
}

func newOverrideFixture() (*AssessmentHandler, *stubStore) {
	store := &stubStore{scores: map[string]domain.Score{
		"sess-1": {SessionID: "sess-1", TotalScore: 40, Verdict: domain.VerdictFail},
	}}
	svc := service.NewAssessmentService(store, stubScenario{}, slog.Default())
	return NewAssessmentHandler(svc), store
}

func TestOverride_RequiresInstructorOrAdmin(t *testing.T) {
	body := []byte(`{"session_id":"sess-1","new_score":100,"verdict":"pass","comment":"manual adjust"}`)

	t.Run("operator forbidden", func(t *testing.T) {
		h, store := newOverrideFixture()
		req := httptest.NewRequest(http.MethodPost, "/assessment/override", bytes.NewReader(body))
		req.Header.Set("X-User-ID", "op-1")
		req.Header.Set("X-Roles", "operator")
		rec := httptest.NewRecorder()
		h.Override(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", rec.Code)
		}
		got := store.scores["sess-1"]
		if got.TotalScore != 40 || got.Verdict != domain.VerdictFail {
			t.Fatalf("score mutated by operator: %+v", got)
		}
	})

	t.Run("instructor allowed", func(t *testing.T) {
		h, _ := newOverrideFixture()
		req := httptest.NewRequest(http.MethodPost, "/assessment/override", bytes.NewReader(body))
		req.Header.Set("X-User-ID", "inst-1")
		req.Header.Set("X-Roles", "instructor")
		rec := httptest.NewRecorder()
		h.Override(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200 body=%s", rec.Code, rec.Body.String())
		}
		var got domain.Score
		if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if got.TotalScore != 100 || got.Verdict != domain.VerdictPass {
			t.Fatalf("score = %+v, want 100/pass", got)
		}
	})

	t.Run("admin allowed", func(t *testing.T) {
		h, _ := newOverrideFixture()
		req := httptest.NewRequest(http.MethodPost, "/assessment/override", bytes.NewReader(body))
		req.Header.Set("X-User-ID", "admin-1")
		req.Header.Set("X-Roles", "admin")
		rec := httptest.NewRecorder()
		h.Override(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200 body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("missing roles forbidden", func(t *testing.T) {
		h, _ := newOverrideFixture()
		req := httptest.NewRequest(http.MethodPost, "/assessment/override", bytes.NewReader(body))
		req.Header.Set("X-User-ID", "anon")
		rec := httptest.NewRecorder()
		h.Override(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", rec.Code)
		}
	})
}
