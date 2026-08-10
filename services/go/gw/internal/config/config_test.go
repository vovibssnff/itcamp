package config

import (
	"testing"
	"time"
)

func gwValidConfig() Config {
	return Config{
		HTTP: HTTPConfig{Addr: ":8080"},
		Auth: AuthClientConfig{URL: "http://auth:8000/introspect"},
		Upstreams: map[string]UpstreamConfig{
			"auth": {URL: "http://auth:8000"},
			"sim":  {URL: "http://sim:9000"},
		},
		Routes: []RouteConfig{
			{Prefix: "/api/v1/auth", Upstream: "auth"},
			{Prefix: "/api/v1/sessions", Upstream: "sim", Auth: true, Roles: []string{"instructor"}},
		},
	}
}

func TestGWConfig_Validate_RolesRequireAuth(t *testing.T) {
	c := gwValidConfig()
	c.Routes = append(c.Routes, RouteConfig{
		Prefix: "/api/v1/x", Upstream: "auth", Roles: []string{"admin"},
	})
	if err := c.validate(); err == nil {
		t.Fatal("expected error when roles set without auth")
	}
}

func TestGWConfig_Validate_Valid(t *testing.T) {
	if err := gwValidConfig().validate(); err != nil {
		t.Fatalf("validate: %v", err)
	}
}

func TestGWConfig_Validate_MissingAddr(t *testing.T) {
	c := gwValidConfig()
	c.HTTP.Addr = ""
	if err := c.validate(); err == nil {
		t.Error("expected error for empty http.addr")
	}
}

func TestGWConfig_Validate_MissingAuthURL(t *testing.T) {
	c := gwValidConfig()
	c.Auth.URL = ""
	if err := c.validate(); err == nil {
		t.Error("expected error for empty auth_client.url")
	}
}

func TestGWConfig_Validate_NoUpstreams(t *testing.T) {
	c := gwValidConfig()
	c.Upstreams = nil
	if err := c.validate(); err == nil {
		t.Error("expected error for no upstreams")
	}
}

func TestGWConfig_Validate_UpstreamMissingURL(t *testing.T) {
	c := gwValidConfig()
	c.Upstreams["auth"] = UpstreamConfig{}
	if err := c.validate(); err == nil {
		t.Error("expected error for upstream without url")
	}
}

func TestGWConfig_Validate_RouteMissingPrefix(t *testing.T) {
	c := gwValidConfig()
	c.Routes = append(c.Routes, RouteConfig{Upstream: "auth"})
	if err := c.validate(); err == nil {
		t.Error("expected error for route without prefix")
	}
}

func TestGWConfig_Validate_RouteUndefinedUpstream(t *testing.T) {
	c := gwValidConfig()
	c.Routes = append(c.Routes, RouteConfig{Prefix: "/x", Upstream: "missing"})
	if err := c.validate(); err == nil {
		t.Error("expected error for route with undefined upstream")
	}
}

func TestGWDuration_UnmarshalText(t *testing.T) {
	tests := []struct {
		in      string
		want    time.Duration
		wantErr bool
	}{
		{"5s", 5 * time.Second, false},
		{"120ms", 120 * time.Millisecond, false},
		{"foo", 0, true},
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
