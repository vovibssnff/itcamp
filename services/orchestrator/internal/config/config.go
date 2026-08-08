package config

import (
	"fmt"
	"os"
	"time"

	"github.com/BurntSushi/toml"
)

type Config struct {
	HTTP     HTTPConfig     `toml:"http"`
	DB       DBConfig       `toml:"db"`
	Redis    RedisConfig    `toml:"redis"`
	NATS     NATSConfig     `toml:"nats"`
	Clients  ClientsConfig  `toml:"clients"`
	Telemetry TelemetryConfig `toml:"telemetry"`
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

type RedisConfig struct {
	Addr     string `toml:"addr"`
	Password string `toml:"password"`
	DB       int    `toml:"db"`
}

type NATSConfig struct {
	URL string `toml:"url"`
}

type ClientsConfig struct {
	ConstructorURL string `toml:"constructor_url"`
	ScenarioURL    string `toml:"scenario_url"`
	SimURL         string `toml:"sim_url"`
	AssessmentURL  string `toml:"assessment_url"`
	SnapshotURL    string `toml:"snapshot_url"`
}

type TelemetryConfig struct {
	Hz          float64 `toml:"hz"`
	TickTimeout Duration `toml:"tick_timeout"`
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

	if v := os.Getenv("ORCHESTRATOR_DB_DSN"); v != "" {
		c.DB.DSN = v
	}
	if v := os.Getenv("ORCHESTRATOR_REDIS_ADDR"); v != "" {
		c.Redis.Addr = v
	}
	if v := os.Getenv("ORCHESTRATOR_NATS_URL"); v != "" {
		c.NATS.URL = v
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
	if c.DB.DSN == "" {
		return fmt.Errorf("db.dsn is required")
	}
	if c.Redis.Addr == "" {
		return fmt.Errorf("redis.addr is required")
	}
	if c.NATS.URL == "" {
		return fmt.Errorf("nats.url is required")
	}
	if c.Telemetry.Hz <= 0 {
		c.Telemetry.Hz = 1.0
	}
	return nil
}
