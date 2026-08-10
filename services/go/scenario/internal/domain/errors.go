package domain

import "errors"

var (
	ErrScenarioNotFound = errors.New("scenario not found")
	ErrFaultNotFound    = errors.New("fault not found")
	ErrInvalidTrigger   = errors.New("invalid trigger specification")
	ErrValidationFailed = errors.New("validation failed")
	ErrCloneFailed      = errors.New("clone failed")
)
