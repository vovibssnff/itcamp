package config

import (
	"fmt"
	"os"

	"github.com/BurntSushi/toml"

	sharedcfg "github.com/itcamp/ktc/shared/go/config"
)

type Config struct {
	HTTP     HTTPConfig     `toml:"http"`
	Provider ProviderConfig `toml:"provider"`
}

type HTTPConfig struct {
	Addr            string   `toml:"addr"`
	ReadTimeout     Duration `toml:"read_timeout"`
	WriteTimeout    Duration `toml:"write_timeout"`
	ShutdownTimeout Duration `toml:"shutdown_timeout"`
}

type ProviderConfig struct {
	Type         string `toml:"type"`
	DockerHost   string `toml:"docker_host"`
	WorkerImage  string `toml:"worker_image"`
	WorkerPort   int    `toml:"port_base"`
	MaxInstances int    `toml:"max_instances"`
	CPURequest   string `toml:"cpu_request"`
	MemRequest   string `toml:"mem_request"`
	Network      string `toml:"network"`
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
	if c.Provider.Type == "" {
		c.Provider.Type = "memory"
	}
	if c.Provider.MaxInstances <= 0 {
		c.Provider.MaxInstances = 50
	}
	if c.Provider.WorkerPort == 0 {
		c.Provider.WorkerPort = 50060
	}
	if c.Provider.WorkerImage == "" {
		c.Provider.WorkerImage = "sim-worker:latest"
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
	switch c.Provider.Type {
	case "memory", "docker":
	default:
		return fmt.Errorf("provider.type must be \"memory\" or \"docker\", got %q", c.Provider.Type)
	}
	return nil
}
