package cache

import "github.com/itcamp/ktc/shared/go/config"

// RedisConfig — общая конфигурация подключения к Redis для всех сервисов.
type RedisConfig struct {
	Addr     string          `toml:"addr"`
	Password string          `toml:"password"`
	DB       int             `toml:"db"`
	TTL      config.Duration `toml:"ttl"`
}
