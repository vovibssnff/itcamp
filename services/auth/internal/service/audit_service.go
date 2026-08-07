package service

import (
	"context"
	"log/slog"
	"time"
)

type AuditEvent string

const (
	AuditLoginSuccess     AuditEvent = "login.success"
	AuditLoginFailed      AuditEvent = "login.failed"
	AuditLoginMFARequired AuditEvent = "login.mfa_required"
	AuditUserLocked       AuditEvent = "user.locked"
	AuditUserCreated      AuditEvent = "user.created"
	AuditUserUpdated      AuditEvent = "user.updated"
	AuditUserDeleted      AuditEvent = "user.deleted"
	AuditRolesChanged     AuditEvent = "user.roles_changed"
	AuditLogout           AuditEvent = "logout"
	AuditTokenRevoked     AuditEvent = "token.revoked"
	AuditMFAEnabled       AuditEvent = "mfa.enabled"
	AuditMFADisabled      AuditEvent = "mfa.disabled"
)

type AuditService struct {
	log *slog.Logger
}

func NewAuditService(log *slog.Logger) *AuditService {
	return &AuditService{log: log.With("component", "audit")}
}

type AuditEntry struct {
	Event     AuditEvent
	UserID    string
	IP        string
	Detail    string
	Timestamp time.Time
}

func (s *AuditService) Log(ctx context.Context, event AuditEvent, userID, ip string) {
	s.log.InfoContext(ctx, string(event),
		"event", event,
		"user_id", userID,
		"ip", ip,
		"ts", time.Now().UTC(),
	)
}

func (s *AuditService) LogDetail(ctx context.Context, event AuditEvent, userID, ip, detail string) {
	s.log.InfoContext(ctx, string(event),
		"event", event,
		"user_id", userID,
		"ip", ip,
		"detail", detail,
		"ts", time.Now().UTC(),
	)
}
