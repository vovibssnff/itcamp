package domain

import "errors"

var (
	ErrSessionNotFound       = errors.New("session not found")
	ErrSessionNotRunning     = errors.New("session is not running")
	ErrSessionNotPaused      = errors.New("session is not paused")
	ErrSessionAlreadyRunning = errors.New("session is already running")
	ErrInvalidSpeed          = errors.New("invalid speed (must be 0.1..10)")
	ErrSnapshotNotFound      = errors.New("snapshot not found")
	ErrExamRestoreForbidden  = errors.New("restore forbidden in exam mode for operator")
	ErrSimUnavailable        = errors.New("simulation engine unavailable")
	ErrScenarioNotFound      = errors.New("scenario not found")
	ErrTemplateNotFound      = errors.New("template not found")
)
