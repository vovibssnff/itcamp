package handler

import (
	"net/http"

	"github.com/itcamp/ktc/services/auth/internal/domain"
	"github.com/itcamp/ktc/services/auth/internal/service"
	"github.com/itcamp/ktc/services/auth/internal/transport/http/dto"
	"github.com/itcamp/ktc/services/auth/internal/transport/http/middleware"
)

type MFAHandler struct {
	mfa *service.MFAService
}

func NewMFAHandler(mfa *service.MFAService) *MFAHandler {
	return &MFAHandler{mfa: mfa}
}

func requireSelfOrAdmin(w http.ResponseWriter, r *http.Request, targetUserID string) bool {
	caller := middleware.ContextUserID(r.Context())
	if caller == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return false
	}
	if caller == targetUserID {
		return true
	}
	roles, _ := r.Context().Value(middleware.CtxRoles).([]domain.Role)
	for _, role := range roles {
		if role == domain.RoleAdmin {
			return true
		}
	}
	http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
	return false
}

func (h *MFAHandler) Setup(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("userID")
	if userID == "" {
		http.Error(w, `{"error":"user_id required"}`, http.StatusBadRequest)
		return
	}
	if !requireSelfOrAdmin(w, r, userID) {
		return
	}
	secret, err := h.mfa.Setup(r.Context(), userID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.MFASetupResponse{Secret: secret})
}

func (h *MFAHandler) Enable(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("userID")
	if userID == "" {
		http.Error(w, `{"error":"user_id required"}`, http.StatusBadRequest)
		return
	}
	if !requireSelfOrAdmin(w, r, userID) {
		return
	}
	var req dto.MFAVerifyRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := h.mfa.Enable(r.Context(), userID, req.Code); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.MFAStatusResponse{Enabled: true})
}

func (h *MFAHandler) Disable(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("userID")
	if userID == "" {
		http.Error(w, `{"error":"user_id required"}`, http.StatusBadRequest)
		return
	}
	if !requireSelfOrAdmin(w, r, userID) {
		return
	}
	if err := h.mfa.Disable(r.Context(), userID); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.MFAStatusResponse{Enabled: false})
}

func (h *MFAHandler) Status(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("userID")
	if userID == "" {
		http.Error(w, `{"error":"user_id required"}`, http.StatusBadRequest)
		return
	}
	if !requireSelfOrAdmin(w, r, userID) {
		return
	}
	enabled, err := h.mfa.IsEnabled(r.Context(), userID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.MFAStatusResponse{Enabled: enabled})
}
