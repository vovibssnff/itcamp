package config

import (
	"fmt"
	"os"
	"time"

	"github.com/BurntSushi/toml"
)

type Config struct {
	HTTP HTTPConfig `toml:"http"`
	DB   DBConfig   `toml:"db"`
	S3   S3Config   `toml:"s3"`
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
	Region    string `toml:"region"`
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
	if v := os.Getenv("SNAPSHOT_DB_DSN"); v != "" {
		c.DB.DSN = v
	}
	if v := os.Getenv("SNAPSHOT_S3_ENDPOINT"); v != "" {
		c.S3.Endpoint = v
	}
	if v := os.Getenv("SNAPSHOT_S3_ACCESS_KEY"); v != "" {
		c.S3.AccessKey = v
	}
	if v := os.Getenv("SNAPSHOT_S3_SECRET_KEY"); v != "" {
		c.S3.SecretKey = v
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
	if c.S3.Endpoint == "" {
		return fmt.Errorf("s3.endpoint is required")
	}
	if c.S3.Bucket == "" {
		return fmt.Errorf("s3.bucket is required")
	}
	return nil
}
