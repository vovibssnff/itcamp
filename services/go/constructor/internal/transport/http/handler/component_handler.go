package handler

import (
	"encoding/json"
	"net/http"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
	"github.com/itcamp/ktc/services/constructor/internal/service"
)

type ComponentHandler struct {
	svc *service.ComponentService
}

func NewComponentHandler(svc *service.ComponentService) *ComponentHandler {
	return &ComponentHandler{svc: svc}
}

func (h *ComponentHandler) List(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	q := r.URL.Query().Get("q")
	limit := queryInt(r, "limit", 50)
	offset := queryInt(r, "offset", 0)

	components, err := h.svc.List(r.Context(), category, q, limit, offset)
	if err != nil {
		writeError(w, err)
		return
	}
	if components == nil {
		components = []domain.ComponentType{}
	}
	writeJSON(w, http.StatusOK, components)
}

func (h *ComponentHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	c, err := h.svc.Get(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (h *ComponentHandler) Create(w http.ResponseWriter, r *http.Request) {
	if !domain.CanManageComponent(rolesFromHeader(r)) {
		writeError(w, domain.ErrForbidden)
		return
	}
	var c domain.ComponentType
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		writeError(w, err)
		return
	}
	created, err := h.svc.Create(r.Context(), c)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *ComponentHandler) Update(w http.ResponseWriter, r *http.Request) {
	if !domain.CanManageComponent(rolesFromHeader(r)) {
		writeError(w, domain.ErrForbidden)
		return
	}
	id := r.PathValue("id")
	var c domain.ComponentType
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		writeError(w, err)
		return
	}
	c.ID = id
	updated, err := h.svc.Update(r.Context(), c)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *ComponentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if !domain.CanDeleteComponent(rolesFromHeader(r)) {
		writeError(w, domain.ErrForbidden)
		return
	}
	id := r.PathValue("id")
	if err := h.svc.Delete(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type importComponentsReq struct {
	Components []domain.ComponentType `json:"components"`
}

func (h *ComponentHandler) Import(w http.ResponseWriter, r *http.Request) {
	if !domain.CanManageComponent(rolesFromHeader(r)) {
		writeError(w, domain.ErrForbidden)
		return
	}
	var req importComponentsReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err)
		return
	}
	result := h.svc.Import(r.Context(), req.Components)
	writeJSON(w, http.StatusOK, result)
}
