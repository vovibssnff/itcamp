package storage

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestGzipCompressDecompress_RoundTrip(t *testing.T) {
	original := []byte(`{"model_time": 42.5, "seed": 12345, "tags": [{"tag_id": "PRSA-204", "value": 3.9}]}`)
	compressed, err := gzipCompress(original)
	if err != nil {
		t.Fatalf("compress failed: %v", err)
	}
	if len(compressed) >= len(original) {
		t.Log("warning: compressed size >= original (expected for small data)")
	}
	decompressed, err := gzipDecompress(compressed)
	if err != nil {
		t.Fatalf("decompress failed: %v", err)
	}
	if !bytes.Equal(original, decompressed) {
		t.Error("round-trip mismatch")
	}
}

func TestGzipCompress_LargeData(t *testing.T) {
	original := make([]byte, 100000)
	for i := range original {
		original[i] = byte(i % 256)
	}
	compressed, err := gzipCompress(original)
	if err != nil {
		t.Fatalf("compress failed: %v", err)
	}
	if len(compressed) >= len(original) {
		t.Errorf("expected compression for large repetitive data, got %d >= %d", len(compressed), len(original))
	}
	decompressed, err := gzipDecompress(compressed)
	if err != nil {
		t.Fatalf("decompress failed: %v", err)
	}
	if !bytes.Equal(original, decompressed) {
		t.Error("round-trip mismatch for large data")
	}
}

func TestGzipDecompress_InvalidData(t *testing.T) {
	_, err := gzipDecompress([]byte("not gzip data"))
	if err == nil {
		t.Fatal("expected error for invalid gzip data")
	}
}

func TestComputeSHA256_KnownValue(t *testing.T) {
	data := []byte("hello world")
	hash := sha256.Sum256(data)
	expected := hex.EncodeToString(hash[:])
	result := ComputeSHA256(data)
	if result != expected {
		t.Errorf("expected %s, got %s", expected, result)
	}
}

func TestComputeSHA256_EmptyData(t *testing.T) {
	result := ComputeSHA256(nil)
	if result == "" {
		t.Error("expected non-empty hash for empty data")
	}
	if len(result) != 64 {
		t.Errorf("expected 64 char hex, got %d", len(result))
	}
}

func TestValidateSHA256_Valid(t *testing.T) {
	data := []byte("test payload")
	hash := ComputeSHA256(data)
	if !ValidateSHA256(data, hash) {
		t.Error("expected valid")
	}
}

func TestValidateSHA256_Invalid(t *testing.T) {
	data := []byte("test payload")
	wrongHash := "0000000000000000000000000000000000000000000000000000000000000000"
	if ValidateSHA256(data, wrongHash) {
		t.Error("expected invalid")
	}
}

func TestValidateSHA256_TamperedData(t *testing.T) {
	original := []byte("original data")
	hash := ComputeSHA256(original)
	tampered := []byte("tampered data")
	if ValidateSHA256(tampered, hash) {
		t.Error("expected invalid for tampered data")
	}
}

func TestGzipCompress_EmptyInput(t *testing.T) {
	compressed, err := gzipCompress(nil)
	if err != nil {
		t.Fatalf("compress failed: %v", err)
	}
	decompressed, err := gzipDecompress(compressed)
	if err != nil {
		t.Fatalf("decompress failed: %v", err)
	}
	if len(decompressed) != 0 {
		t.Errorf("expected empty, got %d bytes", len(decompressed))
	}
}

var _ = gzip.NewWriter
