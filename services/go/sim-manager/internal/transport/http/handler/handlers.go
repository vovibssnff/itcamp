package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/itcamp/ktc/services/sim-manager/internal/domain"
	"github.com/itcamp/ktc/services/sim-manager/internal/service"
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
	case errors.Is(err, domain.ErrSessionNotFound):
		return http.StatusNotFound, "session_not_found"
	case errors.Is(err, domain.ErrQuotaExceeded):
		return http.StatusTooManyRequests, "quota_exceeded"
	case errors.Is(err, domain.ErrAlreadyExists):
		return http.StatusConflict, "already_exists"
	case errors.Is(err, domain.ErrInvalidSpec):
		return http.StatusBadRequest, "invalid_spec"
	case errors.Is(err, domain.ErrInstanceFailed):
		return http.StatusServiceUnavailable, "instance_failed"
	default:
		return http.StatusInternalServerError, "internal"
	}
}

type ManagerHandler struct {
	svc *service.ManagerService
}

func NewManagerHandler(svc *service.ManagerService) *ManagerHandler {
	return &ManagerHandler{svc: svc}
}

func (h *ManagerHandler) CreateSession(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err)
		return
	}
	status, err := h.svc.CreateSession(r.Context(), req)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, status)
}

func (h *ManagerHandler) StopSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.StopSession(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ManagerHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	status, err := h.svc.GetStatus(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (h *ManagerHandler) ListSessions(w http.ResponseWriter, r *http.Request) {
	resp, err := h.svc.ListSessions(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

var _ = context.Background
