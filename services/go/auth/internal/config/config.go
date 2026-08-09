package config

import (
	"fmt"
	"os"

	"github.com/BurntSushi/toml"

	sharedcfg "github.com/itcamp/ktc/shared/go/config"
)

type Config struct {
	HTTP     HTTPConfig     `toml:"http"`
	DB       DBConfig       `toml:"db"`
	JWT      JWTConfig      `toml:"jwt"`
	Auth     AuthConfig     `toml:"auth"`
	LDAP     LDAPConfig     `toml:"ldap"`
	PAM      PAMConfig      `toml:"pam"`
	Security SecurityConfig `toml:"security"`
}

type AuthConfig struct {
	Mode      string     `toml:"mode"`
	StubUsers []StubUser `toml:"stub_users"`
}

type StubUser struct {
	Login    string   `toml:"login"`
	Password string   `toml:"password"`
	FullName string   `toml:"full_name"`
	Roles    []string `toml:"roles"`
}

type HTTPConfig struct {
	Addr            string   `toml:"addr"`
	ReadTimeout     Duration `toml:"read_timeout"`
	WriteTimeout    Duration `toml:"write_timeout"`
	ShutdownTimeout Duration `toml:"shutdown_timeout"`
}

type DBConfig struct {
	DSN          string   `toml:"dsn"`
	MaxConns     int32    `toml:"max_conns"`
	MinConns     int32    `toml:"min_conns"`
	ConnTimeout  Duration `toml:"conn_timeout"`
	QueryTimeout Duration `toml:"query_timeout"`
}

type JWTConfig struct {
	SigningKey    string   `toml:"signing_key"`
	SigningMethod string   `toml:"signing_method"`
	AccessTTL     Duration `toml:"access_ttl"`
	RefreshTTL    Duration `toml:"refresh_ttl"`
	Issuer        string   `toml:"issuer"`
}

type LDAPConfig struct {
	URL             string   `toml:"url"`
	BindDN          string   `toml:"bind_dn"`
	BindPassword    string   `toml:"bind_password"`
	BaseDN          string   `toml:"base_dn"`
	UserFilter      string   `toml:"user_filter"`
	GroupAttr       string   `toml:"group_attr"`
	StartTLS        bool     `toml:"start_tls"`
	SkipVerify      bool     `toml:"skip_verify"`
	Timeout         Duration `toml:"timeout"`
	AdminGroup      string   `toml:"admin_group"`
	InstructorGroup string   `toml:"instructor_group"`
	OperatorGroup   string   `toml:"operator_group"`
}

type PAMConfig struct {
	Enabled  bool   `toml:"enabled"`
	Endpoint string `toml:"endpoint"`
}

type SecurityConfig struct {
	PasswordMinLen   int      `toml:"password_min_len"`
	LockoutThreshold int      `toml:"lockout_threshold"`
	LockoutWindow    Duration `toml:"lockout_window"`
	LockoutDuration  Duration `toml:"lockout_duration"`
	AuthRateLimit    int      `toml:"auth_rate_limit"`
	RateLimitWindow  Duration `toml:"rate_limit_window"`
}

type Duration = sharedcfg.Duration

// Load читает TOML-файл по пути path и применяет env-override для секретов.
// Секреты (dsn, signing_key, bind_password) можно передать через env,
// чтобы не держать их в конфиг-файле.
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

	c.applyEnvOverrides()

	if err := c.validate(); err != nil {
		return Config{}, err
	}
	return c, nil
}

func (c *Config) applyEnvOverrides() {
	if v := os.Getenv("AUTH_DB_DSN"); v != "" {
		c.DB.DSN = v
	}
	if v := os.Getenv("AUTH_JWT_SIGNING_KEY"); v != "" {
		c.JWT.SigningKey = v
	}
	if v := os.Getenv("AUTH_LDAP_BIND_PASSWORD"); v != "" {
		c.LDAP.BindPassword = v
	}
	if v := os.Getenv("AUTH_LDAP_URL"); v != "" {
		c.LDAP.URL = v
	}
	if v := os.Getenv("AUTH_TOTP_ENCRYPTION_KEY"); v != "" {
		c.JWT.SigningKey = v
	}
}

func (c Config) validate() error {
	if c.DB.DSN == "" {
		return fmt.Errorf("db.dsn is required (set in config or AUTH_DB_DSN env)")
	}
	if c.JWT.SigningKey == "" {
		return fmt.Errorf("jwt.signing_key is required (set in config or AUTH_JWT_SIGNING_KEY env)")
	}
	if len(c.JWT.SigningKey) < 32 {
		return fmt.Errorf("jwt.signing_key must be at least 32 bytes")
	}

	mode := c.Auth.Mode
	if mode == "" {
		mode = "ldap"
	}
	switch mode {
	case "ldap":
		if c.LDAP.URL == "" {
			return fmt.Errorf("ldap.url is required (or set auth.mode = \"stub\" for dev)")
		}
		if c.LDAP.BindDN == "" {
			return fmt.Errorf("ldap.bind_dn is required")
		}
		if c.LDAP.BaseDN == "" {
			return fmt.Errorf("ldap.base_dn is required")
		}
	case "stub":
		if len(c.Auth.StubUsers) == 0 {
			return fmt.Errorf("auth.stub_users requires at least one entry in stub mode")
		}
		for i, u := range c.Auth.StubUsers {
			if u.Login == "" {
				return fmt.Errorf("auth.stub_users[%d]: login is required", i)
			}
			if u.Password == "" {
				return fmt.Errorf("auth.stub_users[%d]: password is required", i)
			}
		}
	default:
		return fmt.Errorf("auth.mode must be \"ldap\" or \"stub\", got %q", mode)
	}

	if c.JWT.AccessTTL.Std() <= 0 || c.JWT.RefreshTTL.Std() <= 0 {
		return fmt.Errorf("jwt ttl must be positive")
	}
	if c.JWT.RefreshTTL.Std() <= c.JWT.AccessTTL.Std() {
		return fmt.Errorf("refresh ttl must be greater than access ttl")
	}
	if c.Security.PasswordMinLen < 8 {
		return fmt.Errorf("password_min_len must be at least 8")
	}
	if c.Security.LockoutThreshold < 1 {
		return fmt.Errorf("lockout_threshold must be positive")
	}
	switch c.JWT.SigningMethod {
	case "HS256", "HS384", "HS512":
	default:
		return fmt.Errorf("unsupported jwt signing_method: %s (use HS256/HS384/HS512)", c.JWT.SigningMethod)
	}
	return nil
}
