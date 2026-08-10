package handler

import (
	"errors"
	"net/http"

	"github.com/itcamp/ktc/services/auth/internal/domain"
	"github.com/itcamp/ktc/services/auth/internal/service"
	"github.com/itcamp/ktc/services/auth/internal/transport/http/dto"
	"github.com/itcamp/ktc/services/auth/internal/transport/http/middleware"
)

type AuthHandler struct {
	auth   *service.AuthService
	tokens *service.TokenService
}

func NewAuthHandler(auth *service.AuthService, tokens *service.TokenService) *AuthHandler {
	return &AuthHandler{auth: auth, tokens: tokens}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req dto.LoginRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Login == "" || req.Password == "" {
		http.Error(w, `{"error":"login and password required"}`, http.StatusBadRequest)
		return
	}

	result, err := h.auth.Login(r.Context(), service.LoginInput{
		Login:    req.Login,
		Password: req.Password,
		MFACode:  req.MFACode,
		IP:       middleware.ContextValue(r.Context(), middleware.CtxIP),
	})
	if err != nil {
		if errors.Is(err, domain.ErrMFARequired) {
			writeJSON(w, http.StatusOK, dto.MFARequiredResponse{MFARequired: true})
			return
		}
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, dto.TokenResponse{
		AccessToken:  result.Tokens.AccessToken,
		RefreshToken: result.Tokens.RefreshToken,
		ExpiresIn:    int(result.Tokens.AccessTTL.Seconds()),
		TokenType:    "Bearer",
	})
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req dto.RefreshRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.RefreshToken == "" {
		http.Error(w, `{"error":"refresh_token required"}`, http.StatusBadRequest)
		return
	}

	pair, err := h.auth.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.TokenResponse{
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
		ExpiresIn:    int(pair.AccessTTL.Seconds()),
		TokenType:    "Bearer",
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var req dto.LogoutRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.RefreshToken == "" {
		http.Error(w, `{"error":"refresh_token required"}`, http.StatusBadRequest)
		return
	}
	if err := h.auth.Logout(r.Context(), req.RefreshToken); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
