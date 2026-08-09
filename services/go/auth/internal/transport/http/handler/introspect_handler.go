package handler

import (
	"encoding/json"
	"net/http"

	"github.com/itcamp/ktc/services/auth/internal/service"
	"github.com/itcamp/ktc/services/auth/internal/transport/http/dto"
)

type IntrospectHandler struct {
	svc *service.IntrospectService
}

func NewIntrospectHandler(svc *service.IntrospectService) *IntrospectHandler {
	return &IntrospectHandler{svc: svc}
}

func (h *IntrospectHandler) Introspect(w http.ResponseWriter, r *http.Request) {
	var req dto.IntrospectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err)
		return
	}
	if req.Token == "" {
		writeJSON(w, http.StatusOK, dto.IntrospectResponse{Active: false})
		return
	}

	result, err := h.svc.Introspect(r.Context(), req.Token)
	if err != nil || !result.Active {
		writeJSON(w, http.StatusOK, dto.IntrospectResponse{Active: false})
		return
	}

	resp := dto.IntrospectResponse{Active: true}
	if result.Claims != nil {
		resp.UserID = result.Claims.UserID
		resp.Login = result.Claims.Login
		resp.TokenID = result.Claims.TokenID
		resp.Roles = rolesToStrings(result.Claims.Roles)
	}
	writeJSON(w, http.StatusOK, resp)
}
