package handler

import (
	"net/http"

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
