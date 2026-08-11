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
	S3   S3Config   `toml:"s3"`
	NATS NATSConfig `toml:"nats"`
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

type NATSConfig struct {
	URL             string `toml:"url"`
	ReportTasksSubj string `toml:"report_tasks_subj"`
	QueueGroup      string `toml:"queue_group"`
}

type S3Config struct {
	Endpoint  string `toml:"endpoint"`
	Bucket    string `toml:"bucket"`
	AccessKey string `toml:"access_key"`
	SecretKey string `toml:"secret_key"`
	UseSSL    bool   `toml:"use_ssl"`
	Region    string `toml:"region"`
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
	if v := os.Getenv("REPORT_DB_DSN"); v != "" {
		c.DB.DSN = v
	}
	if v := os.Getenv("REPORT_NATS_URL"); v != "" {
		c.NATS.URL = v
	}
	if v := os.Getenv("REPORT_S3_ENDPOINT"); v != "" {
		c.S3.Endpoint = v
	}
	if v := os.Getenv("REPORT_S3_ACCESS_KEY"); v != "" {
		c.S3.AccessKey = v
	}
	if v := os.Getenv("REPORT_S3_SECRET_KEY"); v != "" {
		c.S3.SecretKey = v
	}
	if c.NATS.ReportTasksSubj == "" {
		c.NATS.ReportTasksSubj = "report.tasks"
	}
	if c.NATS.QueueGroup == "" {
		c.NATS.QueueGroup = "report-workers"
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
	if c.NATS.URL == "" {
		return fmt.Errorf("nats.url is required")
	}
	return nil
}
