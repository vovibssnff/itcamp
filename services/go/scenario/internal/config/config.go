package config

import (
	"fmt"
	"os"

	"github.com/BurntSushi/toml"

	sharedcfg "github.com/itcamp/ktc/shared/go/config"
)

type Config struct {
	HTTP HTTPConfig `toml:"http"`
	DB   DBConfig   `toml:"db"`
	Seed SeedConfig `toml:"seed"`
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

type SeedConfig struct {
	Enabled bool `toml:"enabled"`
}

type Duration = sharedcfg.Duration

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

	if v := os.Getenv("SCENARIO_DB_DSN"); v != "" {
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
		return fmt.Errorf("db.dsn is required (set in config or SCENARIO_DB_DSN env)")
	}
	return nil
}
