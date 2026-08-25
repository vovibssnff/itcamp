package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

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
	case errors.Is(err, domain.ErrForbidden):
		return http.StatusForbidden, "forbidden"
	case errors.Is(err, domain.ErrInvalidTrigger), errors.Is(err, domain.ErrValidationFailed):
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

func rolesFromHeader(r *http.Request) []string {
	raw := r.Header.Get("X-Roles")
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func requireManage(w http.ResponseWriter, r *http.Request) bool {
	if domain.CanManageScenario(rolesFromHeader(r)) {
		return true
	}
	writeError(w, domain.ErrForbidden)
	return false
}

func maybeRedact(r *http.Request, s domain.Scenario) domain.Scenario {
	if domain.MustRedactAnswerKey(rolesFromHeader(r)) {
		return domain.RedactAnswerKey(s)
	}
	return s
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
