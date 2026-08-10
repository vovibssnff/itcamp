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

// authorizeMFATarget allows a user to manage their own MFA, or an admin to
// manage any user's MFA. Path userID alone must never be trusted.
func authorizeMFATarget(r *http.Request, targetUserID string) error {
	callerID := middleware.ContextUserID(r.Context())
	if callerID == "" {
		return domain.ErrTokenInvalid
	}
	if callerID == targetUserID {
		return nil
	}
	if middleware.HasRole(middleware.ContextRoles(r.Context()), string(domain.RoleAdmin)) {
		return nil
	}
	return domain.ErrForbidden
}

func (h *MFAHandler) Setup(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("userID")
	if userID == "" {
		http.Error(w, `{"error":"user_id required"}`, http.StatusBadRequest)
		return
	}
	if err := authorizeMFATarget(r, userID); err != nil {
		writeError(w, err)
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
	if err := authorizeMFATarget(r, userID); err != nil {
		writeError(w, err)
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
	if err := authorizeMFATarget(r, userID); err != nil {
		writeError(w, err)
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
	if err := authorizeMFATarget(r, userID); err != nil {
		writeError(w, err)
		return
	}
	enabled, err := h.mfa.IsEnabled(r.Context(), userID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.MFAStatusResponse{Enabled: enabled})
}
