package config

import "testing"

func TestValidate_MissingAddr(t *testing.T) {
	c := Config{}
	if err := c.validate(); err == nil {
		t.Fatal("expected error for missing addr")
	}
}

func TestValidate_InvalidProviderType(t *testing.T) {
	c := Config{HTTP: HTTPConfig{Addr: ":8080"}, Provider: ProviderConfig{Type: "invalid"}}
	if err := c.validate(); err == nil {
		t.Fatal("expected error for invalid provider type")
	}
}

func TestValidate_ValidMemory(t *testing.T) {
	c := Config{HTTP: HTTPConfig{Addr: ":8080"}, Provider: ProviderConfig{Type: "memory"}}
	if err := c.validate(); err != nil {
		t.Fatalf("expected valid, got %v", err)
	}
}

func TestValidate_ValidDocker(t *testing.T) {
	c := Config{HTTP: HTTPConfig{Addr: ":8080"}, Provider: ProviderConfig{Type: "docker"}}
	if err := c.validate(); err != nil {
		t.Fatalf("expected valid, got %v", err)
	}
}

func TestLoad_MissingFile(t *testing.T) {
	_, err := Load("/nonexistent.toml")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestDuration_UnmarshalText(t *testing.T) {
	var d Duration
	if err := d.UnmarshalText([]byte("10s")); err != nil {
		t.Fatalf("expected success, got %v", err)
	}
}
