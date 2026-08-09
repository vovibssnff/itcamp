package db

import (
	"context"
	"testing"
	"time"
)

// New требует живое соединение с БД (ping) — покрывается интеграционными тестами.
// Здесь проверяется только путь ошибки парсинга DSN, не требующий подключения.
func TestNew_InvalidDSN(t *testing.T) {
	_, err := New(context.Background(), "://invalid dsn", 4, 0, time.Second)
	if err == nil {
		t.Fatal("expected error for invalid DSN")
	}
}

func TestNew_EmptyDSN(t *testing.T) {
	_, err := New(context.Background(), "", 4, 0, time.Second)
	if err == nil {
		t.Fatal("expected error for empty DSN")
	}
}
