package domain

import "time"

type UserStatus string

const (
	UserStatusActive   UserStatus = "active"
	UserStatusLocked   UserStatus = "locked"
	UserStatusDisabled UserStatus = "disabled"
)

type User struct {
	ID        string
	Login     string
	FullName  string
	LDAPDN    string
	Roles     []Role
	Status    UserStatus
	MFAEnabled bool
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (u User) HasRole(r Role) bool {
	for _, role := range u.Roles {
		if role == r {
			return true
		}
	}
	return false
}

func (u User) IsPrivileged() bool {
	for _, role := range u.Roles {
		if role.IsPrivileged() {
			return true
		}
	}
	return false
}
