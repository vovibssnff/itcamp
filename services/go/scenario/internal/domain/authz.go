package domain

const (
	RoleAdmin      = "admin"
	RoleInstructor = "instructor"
	RoleOperator   = "operator"
)

func hasRole(roles []string, role string) bool {
	for _, r := range roles {
		if r == role {
			return true
		}
	}
	return false
}

// CanManageScenario is instructor/admin write access (create/update/delete/import).
func CanManageScenario(roles []string) bool {
	return hasRole(roles, RoleInstructor) || hasRole(roles, RoleAdmin)
}

// MustRedactAnswerKey reports whether exam scoring keys must be stripped
// from API responses. Operators may list/get scenarios for self-service
// training but must not see reference_actions / criteria. Empty roles
// (service-to-service, e.g. orchestrator → GetFull) keep the full payload.
func MustRedactAnswerKey(roles []string) bool {
	if len(roles) == 0 {
		return false
	}
	if CanManageScenario(roles) {
		return false
	}
	return hasRole(roles, RoleOperator)
}

// RedactAnswerKey clears scoring keys and fault schedules from a scenario copy.
func RedactAnswerKey(s Scenario) Scenario {
	s.ReferenceActions = nil
	s.Criteria = Criteria{}
	s.Faults = nil
	return s
}
