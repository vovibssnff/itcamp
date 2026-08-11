package config

import (
	"fmt"
	"os"

	"github.com/BurntSushi/toml"

	sharedcache "github.com/itcamp/ktc/shared/go/cache"
	sharedcfg "github.com/itcamp/ktc/shared/go/config"
)

type Config struct {
	HTTP  HTTPConfig  `toml:"http"`
	DB    DBConfig    `toml:"db"`
	S3    S3Config    `toml:"s3"`
	Redis RedisConfig `toml:"redis"`
	Seed  SeedConfig  `toml:"seed"`
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

type S3Config struct {
	Endpoint  string `toml:"endpoint"`
	Bucket    string `toml:"bucket"`
	AccessKey string `toml:"access_key"`
	SecretKey string `toml:"secret_key"`
	UseSSL    bool   `toml:"use_ssl"`
}

type SeedConfig struct {
	Enabled  bool   `toml:"enabled"`
	SeedFile string `toml:"seed_file"`
}

type RedisConfig = sharedcache.RedisConfig

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

	if v := os.Getenv("CONSTRUCTOR_DB_DSN"); v != "" {
		c.DB.DSN = v
	}
	if v := os.Getenv("CONSTRUCTOR_REDIS_ADDR"); v != "" {
		c.Redis.Addr = v
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
		return fmt.Errorf("db.dsn is required (set in config or CONSTRUCTOR_DB_DSN env)")
	}
	return nil
}
