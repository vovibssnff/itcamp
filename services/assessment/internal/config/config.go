package config

import (
	"fmt"
	"os"
	"time"

	"github.com/BurntSushi/toml"
)

type Config struct {
	HTTP    HTTPConfig    `toml:"http"`
	DB      DBConfig      `toml:"db"`
	Clients ClientsConfig `toml:"clients"`
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

type ClientsConfig struct {
	ScenarioURL string `toml:"scenario_url"`
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
	if v := os.Getenv("ASSESSMENT_DB_DSN"); v != "" {
		c.DB.DSN = v
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
	return nil
}
