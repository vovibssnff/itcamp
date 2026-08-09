package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestDuration_UnmarshalText(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    time.Duration
		wantErr bool
	}{
		{name: "seconds", input: "30s", want: 30 * time.Second},
		{name: "milliseconds", input: "1500ms", want: 1500 * time.Millisecond},
		{name: "minutes", input: "2m", want: 2 * time.Minute},
		{name: "invalid", input: "abc", wantErr: true},
		{name: "empty", input: "", wantErr: true},
		{name: "negative", input: "-5s", want: -5 * time.Second},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var d Duration
			err := d.UnmarshalText([]byte(tt.input))
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error for input %q", tt.input)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if d.Std() != tt.want {
				t.Fatalf("expected %v, got %v", tt.want, d.Std())
			}
		})
	}
}

func TestLoad_MissingFile(t *testing.T) {
	_, err := Load("/nonexistent/path/config.toml")
	if err == nil {
		t.Fatal("expected error for missing config file")
	}
}

func TestLoad_Validation(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")

	tests := []struct {
		name    string
		content string
		wantErr bool
		envDSN  string
	}{
		{
			name:    "valid",
			content: "[http]\naddr = \":8080\"\n\n[db]\ndsn = \"postgres://localhost/db\"\n\n[s3]\nendpoint = \"minio:9000\"\nbucket = \"snapshots\"\n",
			wantErr: false,
		},
		{
			name:    "missing http addr",
			content: "[db]\ndsn = \"postgres://localhost/db\"\n\n[s3]\nendpoint = \"x\"\nbucket = \"y\"\n",
			wantErr: true,
		},
		{
			name:    "missing db dsn",
			content: "[http]\naddr = \":8080\"\n\n[s3]\nendpoint = \"x\"\nbucket = \"y\"\n",
			wantErr: true,
		},
		{
			name:    "missing s3 endpoint",
			content: "[http]\naddr = \":8080\"\n\n[db]\ndsn = \"postgres://localhost/db\"\n\n[s3]\nbucket = \"y\"\n",
			wantErr: true,
		},
		{
			name:    "missing s3 bucket",
			content: "[http]\naddr = \":8080\"\n\n[db]\ndsn = \"postgres://localhost/db\"\n\n[s3]\nendpoint = \"x\"\n",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := os.WriteFile(path, []byte(tt.content), 0o644); err != nil {
				t.Fatalf("write config: %v", err)
			}
			t.Setenv("SNAPSHOT_DB_DSN", tt.envDSN)
			_, err := Load(path)
			if tt.wantErr && err == nil {
				t.Fatal("expected error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestLoad_EnvOverride(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	content := "[http]\naddr = \":8080\"\n\n[db]\ndsn = \"postgres://old/db\"\n\n[s3]\nendpoint = \"minio:9000\"\nbucket = \"snapshots\"\naccess_key = \"old-key\"\nsecret_key = \"old-secret\"\n"
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write config: %v", err)
	}

	t.Setenv("SNAPSHOT_DB_DSN", "postgres://new/db")
	t.Setenv("SNAPSHOT_S3_ENDPOINT", "new:9001")
	t.Setenv("SNAPSHOT_S3_ACCESS_KEY", "new-key")
	t.Setenv("SNAPSHOT_S3_SECRET_KEY", "new-secret")

	c, err := Load(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.DB.DSN != "postgres://new/db" {
		t.Fatalf("expected env db dsn override, got %q", c.DB.DSN)
	}
	if c.S3.Endpoint != "new:9001" {
		t.Fatalf("expected env endpoint override, got %q", c.S3.Endpoint)
	}
	if c.S3.AccessKey != "new-key" {
		t.Fatalf("expected env access key override, got %q", c.S3.AccessKey)
	}
	if c.S3.SecretKey != "new-secret" {
		t.Fatalf("expected env secret key override, got %q", c.S3.SecretKey)
	}
}
