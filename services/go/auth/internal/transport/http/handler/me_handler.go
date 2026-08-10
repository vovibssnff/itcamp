package handler

import (
	"net/http"

	"github.com/itcamp/ktc/services/auth/internal/service"
	"github.com/itcamp/ktc/services/auth/internal/transport/http/middleware"
)

type MeHandler struct {
	users *service.UserService
}

func NewMeHandler(users *service.UserService) *MeHandler {
	return &MeHandler{users: users}
}

func (h *MeHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.ContextUserID(r.Context())
	if userID == "" {
		userID = r.Header.Get("X-User-ID")
	}
	if userID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	user, err := h.users.GetByID(r.Context(), userID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, userToResponse(user))
}
