package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, err error) {
	status, code := mapError(err)
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"type":   "about:blank",
		"title":  code,
		"status": status,
		"detail": err.Error(),
	})
}

func mapError(err error) (int, string) {
	switch {
	case errors.Is(err, domain.ErrComponentNotFound), errors.Is(err, domain.ErrTemplateNotFound):
		return http.StatusNotFound, "not_found"
	case errors.Is(err, domain.ErrComponentInUse):
		return http.StatusConflict, "in_use"
	case errors.Is(err, domain.ErrValidationFailed), errors.Is(err, domain.ErrInvalidGraph):
		return http.StatusUnprocessableEntity, "validation_failed"
	case errors.Is(err, domain.ErrExportFailed):
		return http.StatusInternalServerError, "export_failed"
	default:
		return http.StatusInternalServerError, "internal"
	}
}

func userIDFromHeader(r *http.Request) string {
	return r.Header.Get("X-User-ID")
}

func queryInt(r *http.Request, key string, def int) int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return def
	}
	var n int
	_, _ = fmt.Sscanf(v, "%d", &n)
	if n <= 0 {
		return def
	}
	return n
}
