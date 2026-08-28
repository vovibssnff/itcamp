package handler

import (
	"net/http"
	"strings"

	"github.com/itcamp/ktc/services/assessment/internal/domain"
)

func userIDFromHeader(r *http.Request) string {
	return strings.TrimSpace(r.Header.Get("X-User-ID"))
}

func rolesFromHeader(r *http.Request) []string {
	raw := strings.TrimSpace(r.Header.Get("X-Roles"))
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func isPrivileged(r *http.Request) bool {
	for _, p := range rolesFromHeader(r) {
		if p == "admin" || p == "instructor" {
			return true
		}
	}
	return false
}

// rejectUserFacingInternal — Event/Result/CheckMissed вызываются только
// service-to-service (orchestrator без X-User-ID). Запросы через gw всегда
// несут X-User-ID после JWT introspect — их отклоняем, иначе оператор может
// подделать события оценки или принудительно финализировать чужой экзамен.
func rejectUserFacingInternal(r *http.Request) error {
	if userIDFromHeader(r) != "" {
		return domain.ErrForbidden
	}
	return nil
}

// ensureSessionAccess — для Score/Replay: admin/instructor видят всё;
// operator — только сессии, где он в operator_ids / instructor_id.
// Пустой X-User-ID (S2S orchestrator→assessment) пропускаем.
func (h *AssessmentHandler) ensureSessionAccess(w http.ResponseWriter, r *http.Request, sessionID string) bool {
	uid := userIDFromHeader(r)
	if uid == "" {
		return true
	}
	if err := h.svc.AuthorizeSessionAccess(r.Context(), sessionID, uid, isPrivileged(r)); err != nil {
		writeError(w, err)
		return false
	}
	return true
}
