package domain

import "time"

type TokenPair struct {
	AccessToken  string
	RefreshToken string
	AccessTTL    time.Duration
	RefreshTTL   time.Duration
}

type Claims struct {
	UserID   string   `json:"uid"`
	Login    string   `json:"login"`
	Roles    []Role   `json:"roles"`
	TokenID  string   `json:"jti"`
}

type RefreshToken struct {
	ID        string
	UserID    string
	TokenHash string
	IssuedAt  time.Time
	ExpiresAt time.Time
	Revoked   bool
	ReplacedBy string
}

type IntrospectionResult struct {
	Active bool
	Claims *Claims
}
