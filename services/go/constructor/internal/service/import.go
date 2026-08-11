package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
)

// ImportItemError описывает ошибку одного элемента при пакетном импорте.
type ImportItemError struct {
	ID      string `json:"id,omitempty"`
	Index   int    `json:"index"`
	Message string `json:"message"`
}

// ImportResult — итог пакетного импорта компонентов.
type ImportResult struct {
	Created int               `json:"created"`
	Updated int               `json:"updated"`
	Errors  []ImportItemError `json:"errors"`
}

// ValidateComponent проверяет обязательные поля типа компонента перед импортом.
func ValidateComponent(c domain.ComponentType) error {
	if strings.TrimSpace(c.ID) == "" {
		return errors.New("id is required")
	}
	if strings.TrimSpace(c.Name) == "" {
		return errors.New("name is required")
	}
	if strings.TrimSpace(c.ModelCode) == "" {
		return errors.New("model_code is required")
	}
	switch c.Category {
	case domain.CategoryCommon, domain.CategoryELOU, domain.CategoryAtmosphere, domain.CategoryGDM:
	default:
		return fmt.Errorf("invalid category %q", c.Category)
	}
	for i, p := range c.Ports {
		if strings.TrimSpace(p.ID) == "" {
			return fmt.Errorf("ports[%d].id is required", i)
		}
		switch p.Type {
		case domain.PortLiquid, domain.PortGas, domain.PortSteam, domain.PortElectric, domain.PortSignal:
		default:
			return fmt.Errorf("ports[%d]: invalid type %q", i, p.Type)
		}
		switch p.Direction {
		case domain.PortIn, domain.PortOut:
		default:
			return fmt.Errorf("ports[%d]: invalid direction %q", i, p.Direction)
		}
	}
	for i, p := range c.Parameters {
		if strings.TrimSpace(p.ID) == "" {
			return fmt.Errorf("parameters[%d].id is required", i)
		}
		switch p.Type {
		case domain.ParamFloat, domain.ParamInt, domain.ParamBool, domain.ParamString, domain.ParamSelect:
		default:
			return fmt.Errorf("parameters[%d]: invalid type %q", i, p.Type)
		}
	}
	return nil
}
