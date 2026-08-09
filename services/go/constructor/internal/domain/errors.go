package domain

import "errors"

var (
	ErrComponentNotFound = errors.New("component type not found")
	ErrComponentInUse    = errors.New("component type is used in templates")
	ErrTemplateNotFound  = errors.New("template not found")
	ErrValidationFailed  = errors.New("graph validation failed")
	ErrInvalidGraph      = errors.New("invalid graph format")
	ErrExportFailed      = errors.New("export failed")
	ErrForbidden         = errors.New("insufficient role")
)

type ValidationError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	EdgeID  string `json:"edge_id,omitempty"`
	NodeID  string `json:"node_id,omitempty"`
}

type ValidationResult struct {
	Valid  bool              `json:"valid"`
	Errors []ValidationError `json:"errors"`
}
