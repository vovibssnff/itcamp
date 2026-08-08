package handler

import (
	"encoding/json"
	"net/http"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
	"github.com/itcamp/ktc/services/constructor/internal/service"
)

type TemplateHandler struct {
	svc *service.TemplateService
}

func NewTemplateHandler(svc *service.TemplateService) *TemplateHandler {
	return &TemplateHandler{svc: svc}
}

func (h *TemplateHandler) List(w http.ResponseWriter, r *http.Request) {
	authorID := r.URL.Query().Get("author_id")
	status := r.URL.Query().Get("status")
	q := r.URL.Query().Get("q")
	limit := queryInt(r, "limit", 50)
	offset := queryInt(r, "offset", 0)

	templates, err := h.svc.List(r.Context(), authorID, status, q, limit, offset)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, templates)
}

func (h *TemplateHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	t, err := h.svc.Get(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, t)
}

type createTemplateReq struct {
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Graph       domain.Graph  `json:"graph"`
}

func (h *TemplateHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createTemplateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err)
		return
	}
	t := domain.Template{
		Name:        req.Name,
		Description: req.Description,
		AuthorID:    userIDFromHeader(r),
		Status:      domain.StatusDraft,
		Graph:       req.Graph,
	}
	created, err := h.svc.Create(r.Context(), t)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *TemplateHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req createTemplateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err)
		return
	}
	t := domain.Template{
		ID:          id,
		Name:        req.Name,
		Description: req.Description,
		Graph:       req.Graph,
	}
	updated, err := h.svc.Update(r.Context(), t)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *TemplateHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	force := r.URL.Query().Get("force") == "true"
	if err := h.svc.Delete(r.Context(), id, force); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type copyReq struct {
	NewName string `json:"new_name"`
}

func (h *TemplateHandler) Copy(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req copyReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err)
		return
	}
	clone, err := h.svc.Copy(r.Context(), id, req.NewName)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, clone)
}

func (h *TemplateHandler) Validate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	result, err := h.svc.Validate(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *TemplateHandler) Export(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	state, err := h.svc.Export(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, state)
}
