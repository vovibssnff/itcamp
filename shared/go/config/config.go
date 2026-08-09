// Package config предоставляет общие типы конфигурации, используемые сервисами.
// Duration — обёртка над time.Duration для TOML-декодера (формат "10s", "500ms").
package config

import (
	"fmt"
	"strings"
	"time"
)

// Duration — кастомный длительность для TOML-конфигурации.
type Duration time.Duration

// UnmarshalText парсит текстовое значение длительности (например "10s", "500ms").
// Пробелы по краям игнорируются.
func (d *Duration) UnmarshalText(text []byte) error {
	s := strings.TrimSpace(string(text))
	v, err := time.ParseDuration(s)
	if err != nil {
		return fmt.Errorf("invalid duration %q: %w", s, err)
	}
	*d = Duration(v)
	return nil
}

// Std возвращает длительность как time.Duration.
func (d Duration) Std() time.Duration { return time.Duration(d) }
