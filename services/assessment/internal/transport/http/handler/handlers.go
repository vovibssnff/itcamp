package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/itcamp/ktc/services/assessment/internal/domain"
	"github.com/itcamp/ktc/services/assessment/internal/service"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, err error) {
	status, code := mapError(err)
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"type": "about:blank", "title": code, "status": status, "detail": err.Error()})
}

func mapError(err error) (int, string) {
	switch {
	case errors.Is(err, domain.ErrAssessmentNotFound), errors.Is(err, domain.ErrSessionNotFound):
		return http.StatusNotFound, "not_found"
	case errors.Is(err, domain.ErrAlreadyFinalized):
		return http.StatusConflict, "already_finalized"
	case errors.Is(err, domain.ErrOverrideNoComment):
		return http.StatusBadRequest, "override_no_comment"
	case errors.Is(err, domain.ErrScenarioNotLoaded):
		return http.StatusBadRequest, "scenario_not_loaded"
	default:
		return http.StatusInternalServerError, "internal"
	}
}

func userIDFromHeader(r *http.Request) string {
	return r.Header.Get("X-User-ID")
}

type AssessmentHandler struct {
	svc *service.AssessmentService
}

func NewAssessmentHandler(svc *service.AssessmentService) *AssessmentHandler {
	return &AssessmentHandler{svc: svc}
}

func (h *AssessmentHandler) Event(w http.ResponseWriter, r *http.Request) {
	var event domain.AssessmentEvent
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		writeError(w, err)
		return
	}
	scenarioID := r.URL.Query().Get("scenario_id")
	if err := h.svc.ProcessEvent(r.Context(), event, scenarioID); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func (h *AssessmentHandler) Score(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	score, err := h.svc.GetScore(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, score)
}

func (h *AssessmentHandler) Result(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	score, err := h.svc.Finalize(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, score)
}

func (h *AssessmentHandler) Override(w http.ResponseWriter, r *http.Request) {
	var req domain.Override
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err)
		return
	}
	req.ByUserID = userIDFromHeader(r)
	score, err := h.svc.Override(r.Context(), req)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, score)
}

func (h *AssessmentHandler) Replay(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	replay, err := h.svc.GetReplay(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, replay)
}

var _ = fmt.Sprintf
