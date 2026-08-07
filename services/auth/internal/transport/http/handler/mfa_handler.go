package handler

import (
	"encoding/json"
	"net/http"

	"github.com/itcamp/ktc/services/auth/internal/service"
	"github.com/itcamp/ktc/services/auth/internal/transport/http/dto"
)

type MFAHandler struct {
	mfa *service.MFAService
}

func NewMFAHandler(mfa *service.MFAService) *MFAHandler {
	return &MFAHandler{mfa: mfa}
}

func (h *MFAHandler) Setup(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("userID")
	if userID == "" {
		http.Error(w, `{"error":"user_id required"}`, http.StatusBadRequest)
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
	var req dto.MFAVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err)
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
	enabled, err := h.mfa.IsEnabled(r.Context(), userID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.MFAStatusResponse{Enabled: enabled})
}
