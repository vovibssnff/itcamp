package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
)

// ImportItemError описывает ошибку одного элемента при пакетном импорте.
type ImportItemError struct {
	ID      string `json:"id,omitempty"`
	Index   int    `json:"index"`
	Message string `json:"message"`
}

// ImportResult — итог пакетного импорта.
type ImportResult struct {
	Created int               `json:"created"`
	Updated int               `json:"updated"`
	Errors  []ImportItemError `json:"errors"`
}

// ValidateFault проверяет обязательные поля каталожной неисправности.
func ValidateFault(f domain.Fault) error {
	if strings.TrimSpace(f.FaultID) == "" {
		return errors.New("fault_id is required")
	}
	if strings.TrimSpace(f.Name) == "" {
		return errors.New("name is required")
	}
	if len(f.ApplicableComponentTypes) == 0 {
		return errors.New("applicable_component_types must be non-empty")
	}
	switch f.Severity {
	case domain.SeverityLow, domain.SeverityMedium, domain.SeverityHigh, domain.SeverityCritical:
	default:
		return fmt.Errorf("invalid severity %q", f.Severity)
	}
	return nil
}
