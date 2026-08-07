package handler

import (
	"encoding/json"
	"net/http"

	"github.com/itcamp/ktc/services/auth/internal/domain"
	"github.com/itcamp/ktc/services/auth/internal/service"
	"github.com/itcamp/ktc/services/auth/internal/transport/http/dto"
)

type UserHandler struct {
	users *service.UserService
}

func NewUserHandler(users *service.UserService) *UserHandler {
	return &UserHandler{users: users}
}

func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.users.List(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	resp := make([]dto.UserResponse, 0, len(users))
	for _, u := range users {
		resp = append(resp, userToResponse(u))
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *UserHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	user, err := h.users.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, userToResponse(user))
}

func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err)
		return
	}
	if req.Login == "" {
		http.Error(w, `{"error":"login required"}`, http.StatusBadRequest)
		return
	}
	user, err := h.users.Create(r.Context(), service.CreateUserInput{
		Login: req.Login, FullName: req.FullName, LDAPDN: req.LDAPDN,
		Roles: stringsToRoles(req.Roles),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, userToResponse(user))
}

func (h *UserHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req dto.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err)
		return
	}
	in := service.UpdateUserInput{
		FullName: req.FullName, LDAPDN: req.LDAPDN,
		Status: domain.UserStatus(req.Status),
	}
	if req.Roles != nil {
		in.Roles = stringsToRoles(req.Roles)
	}
	user, err := h.users.Update(r.Context(), id, in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, userToResponse(user))
}

func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.users.Delete(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
