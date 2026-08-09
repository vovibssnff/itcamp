package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"fmt"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
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
		"type": "about:blank", "title": code, "status": status, "detail": err.Error(),
	})
}

func mapError(err error) (int, string) {
	switch {
	case errors.Is(err, domain.ErrScenarioNotFound), errors.Is(err, domain.ErrFaultNotFound):
		return http.StatusNotFound, "not_found"
	case errors.Is(err, domain.ErrInvalidTrigger):
		return http.StatusUnprocessableEntity, "validation_failed"
	case errors.Is(err, domain.ErrCloneFailed):
		return http.StatusInternalServerError, "clone_failed"
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
