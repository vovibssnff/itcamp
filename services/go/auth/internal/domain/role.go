package domain

type Role string

const (
	RoleAdmin      Role = "admin"
	RoleInstructor Role = "instructor"
	RoleOperator   Role = "operator"
)

func (r Role) Valid() bool {
	switch r {
	case RoleAdmin, RoleInstructor, RoleOperator:
		return true
	}
	return false
}

func (r Role) IsPrivileged() bool {
	return r == RoleAdmin || r == RoleInstructor
}

func AllRoles() []Role {
	return []Role{RoleAdmin, RoleInstructor, RoleOperator}
}
