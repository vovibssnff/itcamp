package config

import "testing"

func TestLoad_MissingFile(t *testing.T) {
	_, err := Load("/nonexistent/path.toml")
	if err == nil {
		t.Fatal("expected error for missing file")
	}
}

func TestValidate_MissingAddr(t *testing.T) {
	c := Config{}
	err := c.validate()
	if err == nil {
		t.Fatal("expected error for missing addr")
	}
}

func TestValidate_MissingDSN(t *testing.T) {
	c := Config{HTTP: HTTPConfig{Addr: ":8080"}}
	err := c.validate()
	if err == nil {
		t.Fatal("expected error for missing DSN")
	}
}

func TestValidate_Valid(t *testing.T) {
	c := Config{
		HTTP: HTTPConfig{Addr: ":8080"},
		DB:   DBConfig{DSN: "postgres://localhost/ktc"},
		S3:   S3Config{Endpoint: "minio:9000", Bucket: "snapshots"},
	}
	if err := c.validate(); err != nil {
		t.Fatalf("expected valid, got %v", err)
	}
}

func TestValidate_S3Missing(t *testing.T) {
	c := Config{
		HTTP: HTTPConfig{Addr: ":8080"},
		DB:   DBConfig{DSN: "postgres://localhost/ktc"},
	}
	err := c.validate()
	if err == nil {
		t.Fatal("expected error for missing S3 endpoint")
	}
}

func TestValidate_S3BucketMissing(t *testing.T) {
	c := Config{
		HTTP: HTTPConfig{Addr: ":8080"},
		DB:   DBConfig{DSN: "postgres://localhost/ktc"},
		S3:   S3Config{Endpoint: "minio:9000"},
	}
	err := c.validate()
	if err == nil {
		t.Fatal("expected error for missing S3 bucket")
	}
}

func TestValidate_FullValid(t *testing.T) {
	c := Config{
		HTTP: HTTPConfig{Addr: ":8080", ReadTimeout: Duration(0), WriteTimeout: Duration(0), ShutdownTimeout: Duration(0)},
		DB:   DBConfig{DSN: "postgres://localhost/ktc"},
		S3:   S3Config{Endpoint: "minio:9000", Bucket: "snapshots"},
	}
	if err := c.validate(); err != nil {
		t.Fatalf("expected valid, got %v", err)
	}
}

func TestDuration_UnmarshalText(t *testing.T) {
	cases := []struct {
		input   string
		success bool
	}{
		{"10s", true},
		{"5m", true},
		{"1h", true},
		{"500ms", true},
		{"invalid", false},
		{"", false},
	}
	for _, tc := range cases {
		var d Duration
		err := d.UnmarshalText([]byte(tc.input))
		if tc.success && err != nil {
			t.Errorf("expected success for %q, got %v", tc.input, err)
		}
		if !tc.success && err == nil {
			t.Errorf("expected error for %q", tc.input)
		}
	}
}

func TestDuration_Std(t *testing.T) {
	var d Duration
	d.UnmarshalText([]byte("10s"))
	if d.Std().String() != "10s" {
		t.Errorf("expected 10s, got %v", d.Std())
	}
}
