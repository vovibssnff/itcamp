package service

import "github.com/itcamp/ktc/shared/go/uid"

// newUUID возвращает новый UUID v4 (делегируется общему пакету uid).
func newUUID() string { return uid.New() }
