package handler

import (
	"net/http"
	"strings"

	"github.com/itcamp/ktc/services/report/internal/domain"
)

// isPrivileged — admin/instructor видят все отчёты; operator — только свои.
func isPrivileged(r *http.Request) bool {
	raw := strings.TrimSpace(r.Header.Get("X-Roles"))
	for _, p := range strings.Split(raw, ",") {
		p = strings.TrimSpace(p)
		if p == "admin" || p == "instructor" {
			return true
		}
	}
	return false
}

func userIDFromHeader(r *http.Request) string {
	return strings.TrimSpace(r.Header.Get("X-User-ID"))
}

// ensureSessionAccess запрещает оператору чужие сессии (IDOR на Get/List/Download/File/Create).
func (h *ReportHandler) ensureSessionAccess(w http.ResponseWriter, r *http.Request, sessionID string) bool {
	privileged := isPrivileged(r)
	uid := userIDFromHeader(r)
	if err := h.svc.AuthorizeSessionAccess(r.Context(), sessionID, uid, privileged); err != nil {
		writeError(w, err)
		return false
	}
	return true
}

// decideSessionAccess — чистая проверка для unit-тестов (зеркало AuthorizeSessionAccess).
func decideSessionAccess(privileged bool, userID string, member bool) error {
	if privileged {
		return nil
	}
	if userID == "" || !member {
		return domain.ErrForbidden
	}
	return nil
}
