// Package audit предоставляет общий механизм записи событий аудита в структурные
// логи (slog) для последующего сбора сторонней системой (SIEM/fluentd).
//
// События аудита пишутся с ключами component="audit", event="audit.<name>" и
// actor=<инициатор действия>, что позволяет единообразно агрегировать журнал
// действий пользователей по всем сервисам.
package audit

import (
	"context"
	"log/slog"
)

type actorCtxKey struct{}

// WithActor возвращает контекст с идентификатором актора (инициатора действия),
// прочитанным из заголовка X-User-ID. Используется службой аудита для фиксации
// того, кто выполнил действие.
func WithActor(ctx context.Context, actor string) context.Context {
	if actor == "" {
		return ctx
	}
	return context.WithValue(ctx, actorCtxKey{}, actor)
}

// Actor возвращает идентификатор актора из контекста или пустую строку.
func Actor(ctx context.Context) string {
	v, _ := ctx.Value(actorCtxKey{}).(string)
	return v
}

// Emit пишет событие аудита в лог (для дальнейшего сбора сторонней системой/SIEM).
// Ничего не делает, если логгер не задан.
func Emit(ctx context.Context, log *slog.Logger, event string, attrs ...any) {
	if log == nil {
		return
	}
	all := make([]any, 0, len(attrs)+3)
	all = append(all, "component", "audit", "event", event, "actor", Actor(ctx))
	all = append(all, attrs...)
	log.InfoContext(ctx, "audit."+event, all...)
}
