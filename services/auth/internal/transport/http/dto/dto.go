package dto

type LoginRequest struct {
	Login    string `json:"login"`
	Password string `json:"password"`
	MFACode  string `json:"mfa_code,omitempty"`
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

type MFARequiredResponse struct {
	MFARequired bool `json:"mfa_required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type MFAVerifyRequest struct {
	Code string `json:"code"`
}

type MFASetupResponse struct {
	Secret string `json:"secret"`
}

type MFAStatusResponse struct {
	Enabled bool `json:"enabled"`
}

type IntrospectRequest struct {
	Token string `json:"token"`
}

type IntrospectResponse struct {
	Active  bool     `json:"active"`
	UserID  string   `json:"user_id,omitempty"`
	Login   string   `json:"login,omitempty"`
	Roles   []string `json:"roles,omitempty"`
	TokenID string   `json:"token_id,omitempty"`
}

type UserResponse struct {
	ID         string   `json:"id"`
	Login      string   `json:"login"`
	FullName   string   `json:"full_name"`
	LDAPDN     string   `json:"ldap_dn"`
	Roles      []string `json:"roles"`
	Status     string   `json:"status"`
	MFAEnabled bool     `json:"mfa_enabled"`
}

type ErrorResponse struct {
	Error string `json:"error"`
	Code  string `json:"code,omitempty"`
}
