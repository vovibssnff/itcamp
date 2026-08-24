package domain

const (
	RoleAdmin      = "admin"
	RoleInstructor = "instructor"
)

func hasRole(roles []string, role string) bool {
	for _, r := range roles {
		if r == role {
			return true
		}
	}
	return false
}

// CanOverrideScore is instructor/admin only (FR-ASSESS-05).
func CanOverrideScore(roles []string) bool {
	return hasRole(roles, RoleInstructor) || hasRole(roles, RoleAdmin)
}
