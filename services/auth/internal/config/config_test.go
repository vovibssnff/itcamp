package config

import (
	"strings"
	"testing"
	"time"
)

func TestDuration_UnmarshalText(t *testing.T) {
	tests := []struct {
		in      string
		want    time.Duration
		wantErr bool
	}{
		{"500ms", 500 * time.Millisecond, false},
		{"15s", 15 * time.Second, false},
		{"10m", 10 * time.Minute, false},
		{"24h", 24 * time.Hour, false},
		{" 30s ", 30 * time.Second, false},
		{"abc", 0, true},
		{"", 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			var d Duration
			err := d.UnmarshalText([]byte(tt.in))
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error for %q", tt.in)
				}
				return
			}
			if err != nil {
				t.Fatalf("UnmarshalText(%q): %v", tt.in, err)
			}
			if d.Std() != tt.want {
				t.Errorf("Std() = %v, want %v", d.Std(), tt.want)
			}
		})
	}
}

func validConfig() Config {
	return Config{
		DB:  DBConfig{DSN: "postgres://u:p@host/db"},
		JWT: JWTConfig{
			SigningKey:    strings.Repeat("k", 32),
			SigningMethod: "HS256",
			AccessTTL:     Duration(15 * time.Minute),
			RefreshTTL:    Duration(24 * time.Hour),
		},
		Auth: AuthConfig{Mode: "stub", StubUsers: []StubUser{{Login: "a", Password: "b", Roles: []string{"admin"}}}},
		Security: SecurityConfig{
			PasswordMinLen:   8,
			LockoutThreshold: 5,
		},
	}
}

func TestConfig_Validate_Valid(t *testing.T) {
	if err := validConfig().validate(); err != nil {
		t.Fatalf("validate: %v", err)
	}
}

func TestConfig_Validate_SigningKeyShort(t *testing.T) {
	c := validConfig()
	c.JWT.SigningKey = "short"
	if err := c.validate(); err == nil {
		t.Error("expected error for short signing key")
	}
}

func TestConfig_Validate_MissingDSN(t *testing.T) {
	c := validConfig()
	c.DB.DSN = ""
	if err := c.validate(); err == nil {
		t.Error("expected error for empty DSN")
	}
}

func TestConfig_Validate_DefaultModeLDAP(t *testing.T) {
	c := validConfig()
	c.Auth.Mode = ""
	c.Auth.StubUsers = nil
	// LDAP params missing -> error
	if err := c.validate(); err == nil {
		t.Error("expected error for ldap mode without ldap.url")
	}
}

func TestConfig_Validate_StubModeRequiresUsers(t *testing.T) {
	c := validConfig()
	c.Auth.Mode = "stub"
	c.Auth.StubUsers = nil
	if err := c.validate(); err == nil {
		t.Error("expected error for stub mode without users")
	}
}

func TestConfig_Validate_UnknownMode(t *testing.T) {
	c := validConfig()
	c.Auth.Mode = "oauth"
	if err := c.validate(); err == nil {
		t.Error("expected error for unknown auth mode")
	}
}

func TestConfig_Validate_RefreshTTLNotGreater(t *testing.T) {
	c := validConfig()
	c.JWT.RefreshTTL = Duration(5 * time.Minute)
	c.JWT.AccessTTL = Duration(15 * time.Minute)
	if err := c.validate(); err == nil {
		t.Error("expected error when refresh ttl <= access ttl")
	}
}

func TestConfig_Validate_PasswordMinLen(t *testing.T) {
	c := validConfig()
	c.Security.PasswordMinLen = 4
	if err := c.validate(); err == nil {
		t.Error("expected error for password_min_len < 8")
	}
}

func TestConfig_Validate_UnsupportedSigningMethod(t *testing.T) {
	c := validConfig()
	c.JWT.SigningMethod = "RS256"
	if err := c.validate(); err == nil {
		t.Error("expected error for unsupported signing method")
	}
}
