package config

import (
	"fmt"
	"os"
	"time"

	"github.com/BurntSushi/toml"
)

type Config struct {
	HTTP      HTTPConfig                `toml:"http"`
	Auth      AuthClientConfig          `toml:"auth_client"`
	Upstreams map[string]UpstreamConfig `toml:"upstreams"`
	Routes    []RouteConfig             `toml:"routes"`
	Security  GWSecurityConfig          `toml:"security"`
}

type HTTPConfig struct {
	Addr            string   `toml:"addr"`
	ReadTimeout     Duration `toml:"read_timeout"`
	WriteTimeout    Duration `toml:"write_timeout"`
	ShutdownTimeout Duration `toml:"shutdown_timeout"`
}

type AuthClientConfig struct {
	URL          string   `toml:"url"`
	Timeout      Duration `toml:"timeout"`
	CacheTTL     Duration `toml:"cache_ttl"`
	CacheMaxSize int      `toml:"cache_max_size"`
}

type UpstreamConfig struct {
	URL string `toml:"url"`
}

type RouteConfig struct {
	Prefix      string   `toml:"prefix"`
	Upstream    string   `toml:"upstream"`
	StripPrefix string   `toml:"strip_prefix"`
	Methods     []string `toml:"methods"`
	Roles       []string `toml:"roles"`
	Auth        bool     `toml:"auth"`
	WebSocket   bool     `toml:"websocket"`
}

type GWSecurityConfig struct {
	RateLimitPerMin int `toml:"rate_limit_per_min"`
}

type Duration time.Duration

func (d *Duration) UnmarshalText(text []byte) error {
	s := string(text)
	v, err := time.ParseDuration(s)
	if err != nil {
		return fmt.Errorf("invalid duration %q: %w", s, err)
	}
	*d = Duration(v)
	return nil
}

func (d Duration) Std() time.Duration { return time.Duration(d) }

func Load(path string) (Config, error) {
	var c Config

	if path != "" {
		if _, err := os.Stat(path); err != nil {
			return Config{}, fmt.Errorf("config file: %w", err)
		}
		if _, err := toml.DecodeFile(path, &c); err != nil {
			return Config{}, fmt.Errorf("decode toml: %w", err)
		}
	}

	if v := os.Getenv("GW_AUTH_URL"); v != "" {
		c.Auth.URL = v
	}

	if err := c.validate(); err != nil {
		return Config{}, err
	}
	return c, nil
}

func (c Config) validate() error {
	if c.HTTP.Addr == "" {
		return fmt.Errorf("http.addr is required")
	}
	if c.Auth.URL == "" {
		return fmt.Errorf("auth_client.url is required")
	}
	if len(c.Upstreams) == 0 {
		return fmt.Errorf("at least one upstream is required")
	}
	for name, up := range c.Upstreams {
		if up.URL == "" {
			return fmt.Errorf("upstream %q: url is required", name)
		}
	}
	for i, r := range c.Routes {
		if r.Prefix == "" {
			return fmt.Errorf("route[%d]: prefix is required", i)
		}
		if r.Upstream == "" {
			return fmt.Errorf("route[%d]: upstream is required", i)
		}
		if _, ok := c.Upstreams[r.Upstream]; !ok {
			return fmt.Errorf("route[%d]: upstream %q not defined", i, r.Upstream)
		}
	}
	return nil
}
