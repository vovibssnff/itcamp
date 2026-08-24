package domain

import "errors"

var (
	ErrAssessmentNotFound = errors.New("assessment not found")
	ErrSessionNotFound    = errors.New("session not found")
	ErrAlreadyFinalized   = errors.New("assessment already finalized")
	ErrOverrideNoComment  = errors.New("override requires comment")
	ErrForbidden          = errors.New("forbidden")
	ErrScenarioNotLoaded  = errors.New("scenario not loaded for session")
	ErrScenarioNotFound   = errors.New("scenario not found")
)
