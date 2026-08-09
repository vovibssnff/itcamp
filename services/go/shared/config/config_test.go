package config

import (
	"testing"
	"time"
)

func TestDuration_UnmarshalText(t *testing.T) {
	var d Duration
	if err := d.UnmarshalText([]byte("10s")); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if d.Std() != 10*time.Second {
		t.Errorf("got %v, want 10s", d.Std())
	}

	var ms Duration
	if err := ms.UnmarshalText([]byte(" 500ms ")); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ms.Std() != 500*time.Millisecond {
		t.Errorf("got %v, want 500ms", ms.Std())
	}
}

func TestDuration_UnmarshalText_TrailingSpace(t *testing.T) {
	var d Duration
	if err := d.UnmarshalText([]byte(" 30s ")); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if d.Std() != 30*time.Second {
		t.Errorf("got %v, want 30s", d.Std())
	}
}

func TestDuration_UnmarshalText_Invalid(t *testing.T) {
	var d Duration
	if err := d.UnmarshalText([]byte("abc")); err == nil {
		t.Fatal("expected error for invalid duration")
	}
}
