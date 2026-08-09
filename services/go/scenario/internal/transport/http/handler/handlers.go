package handler

import (
	"encoding/json"
	"net/http"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
	"github.com/itcamp/ktc/services/scenario/internal/service"
)

type ScenarioHandler struct {
	svc *service.ScenarioService
}

func NewScenarioHandler(svc *service.ScenarioService) *ScenarioHandler {
	return &ScenarioHandler{svc: svc}
}

func (h *ScenarioHandler) List(w http.ResponseWriter, r *http.Request) {
	templateID := r.URL.Query().Get("template_id")
	stype := r.URL.Query().Get("type")
	q := r.URL.Query().Get("q")
	limit := queryInt(r, "limit", 50)
	offset := queryInt(r, "offset", 0)
	scenarios, err := h.svc.List(r.Context(), templateID, stype, q, limit, offset)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, scenarios)
}

func (h *ScenarioHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s, err := h.svc.Get(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s)
}

func (h *ScenarioHandler) Create(w http.ResponseWriter, r *http.Request) {
	var s domain.Scenario
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		writeError(w, err)
		return
	}
	s.AuthorID = userIDFromHeader(r)
	created, err := h.svc.Create(r.Context(), s)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *ScenarioHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var s domain.Scenario
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		writeError(w, err)
		return
	}
	s.ID = id
	updated, err := h.svc.Update(r.Context(), s)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *ScenarioHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Delete(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ScenarioHandler) Clone(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		TemplateID string `json:"template_id"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	clone, err := h.svc.Clone(r.Context(), id, req.TemplateID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, clone)
}

func (h *ScenarioHandler) GetFull(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s, err := h.svc.GetFull(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s)
}

func (h *ScenarioHandler) GetRandomExam(w http.ResponseWriter, r *http.Request) {
	templateID := r.URL.Query().Get("template_id")
	s, err := h.svc.GetRandomExam(r.Context(), templateID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s)
}

type FaultHandler struct {
	svc *service.FaultService
}

func NewFaultHandler(svc *service.FaultService) *FaultHandler {
	return &FaultHandler{svc: svc}
}

func (h *FaultHandler) List(w http.ResponseWriter, r *http.Request) {
	componentType := r.URL.Query().Get("component_type")
	severity := r.URL.Query().Get("severity")
	faults, err := h.svc.List(r.Context(), componentType, severity)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, faults)
}

func (h *FaultHandler) Get(w http.ResponseWriter, r *http.Request) {
	faultID := r.PathValue("fault_id")
	f, err := h.svc.Get(r.Context(), faultID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, f)
}
