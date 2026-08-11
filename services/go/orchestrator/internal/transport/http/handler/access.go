package handler

import (
	"net/http"
	"strings"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

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

func hasAnyRole(roles []string, want ...string) bool {
	set := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		set[r] = struct{}{}
	}
	for _, w := range want {
		if _, ok := set[w]; ok {
			return true
		}
	}
	return false
}

func isPrivileged(roles []string) bool {
	return hasAnyRole(roles, "instructor", "admin")
}

func canAccessSession(r *http.Request, sess domain.Session) bool {
	roles := rolesFromHeader(r)
	if isPrivileged(roles) {
		return true
	}
	uid := userIDFromHeader(r)
	if uid == "" {
		return false
	}
	if sess.InstructorID == uid {
		return true
	}
	for _, op := range sess.OperatorIDs {
		if op == uid {
			return true
		}
	}
	return false
}

func canCreateSession(r *http.Request, mode string, operatorIDs []string) bool {
	roles := rolesFromHeader(r)
	if isPrivileged(roles) {
		return true
	}
	if !hasAnyRole(roles, "operator") {
		return false
	}
	uid := userIDFromHeader(r)
	if uid == "" {
		return false
	}
	if mode == "" {
		mode = string(domain.ModeTraining)
	}
	if mode != string(domain.ModeTraining) {
		return false
	}
	return len(operatorIDs) == 1 && operatorIDs[0] == uid
}

func loadSessionOrDeny(h *SessionHandler, w http.ResponseWriter, r *http.Request, id string) (domain.Session, bool) {
	sess, err := h.svc.Get(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return domain.Session{}, false
	}
	if !canAccessSession(r, sess) {
		writeError(w, domain.ErrForbidden)
		return domain.Session{}, false
	}
	return sess, true
}
