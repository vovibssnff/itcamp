package config

import "testing"

func TestValidate_MissingAddr(t *testing.T) {
	c := Config{}
	if err := c.validate(); err == nil {
		t.Fatal("expected error for missing addr")
	}
}

func TestValidate_MissingDSN(t *testing.T) {
	c := Config{HTTP: HTTPConfig{Addr: ":8080"}}
	if err := c.validate(); err == nil {
		t.Fatal("expected error for missing DSN")
	}
}

func TestValidate_MissingRedis(t *testing.T) {
	c := Config{HTTP: HTTPConfig{Addr: ":8080"}, DB: DBConfig{DSN: "postgres://localhost/ktc"}}
	if err := c.validate(); err == nil {
		t.Fatal("expected error for missing redis")
	}
}

func TestValidate_MissingNATS(t *testing.T) {
	c := Config{
		HTTP:   HTTPConfig{Addr: ":8080"},
		DB:     DBConfig{DSN: "postgres://localhost/ktc"},
		Redis:  RedisConfig{Addr: "localhost:6379"},
	}
	if err := c.validate(); err == nil {
		t.Fatal("expected error for missing NATS")
	}
}

func TestValidate_Valid(t *testing.T) {
	c := Config{
		HTTP:   HTTPConfig{Addr: ":8080"},
		DB:     DBConfig{DSN: "postgres://localhost/ktc"},
		Redis:  RedisConfig{Addr: "localhost:6379"},
		NATS:   NATSConfig{URL: "nats://localhost:4222"},
	}
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
	if err := d.UnmarshalText([]byte("30s")); err != nil {
		t.Fatalf("expected success, got %v", err)
	}
}
