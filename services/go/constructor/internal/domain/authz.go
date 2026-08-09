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

func CanEditTemplate(roles []string) bool {
	return hasRole(roles, RoleInstructor)
}

func CanDeleteTemplate(roles []string, force bool) bool {
	if force {
		return hasRole(roles, RoleAdmin)
	}
	return hasRole(roles, RoleInstructor)
}

func CanManageComponent(roles []string) bool {
	return hasRole(roles, RoleInstructor) || hasRole(roles, RoleAdmin)
}

func CanDeleteComponent(roles []string) bool {
	return hasRole(roles, RoleAdmin)
}
