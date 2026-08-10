package security

import (
	"strings"
	"testing"
	"time"

	"github.com/pquerna/otp/totp"
)

const testKey = "0123456789abcdef0123456789abcdef" // 32 bytes

func TestNewTOTPService_KeyLength(t *testing.T) {
	if _, err := NewTOTPService([]byte("short")); err == nil {
		t.Error("expected error for short key")
	}
	if _, err := NewTOTPService([]byte(testKey)); err != nil {
		t.Errorf("unexpected error for 32-byte key: %v", err)
	}
}

func TestTOTPService_GenerateSecret(t *testing.T) {
	s, _ := NewTOTPService([]byte(testKey))
	secret, err := s.GenerateSecret("user-1")
	if err != nil {
		t.Fatalf("GenerateSecret: %v", err)
	}
	if len(secret) == 0 {
		t.Error("secret should not be empty")
	}
}

func TestTOTPService_Validate_ValidCode(t *testing.T) {
	s, _ := NewTOTPService([]byte(testKey))
	secret, err := s.GenerateSecret("user-1")
	if err != nil {
		t.Fatalf("GenerateSecret: %v", err)
	}
	code, err := totp.GenerateCode(secret, time.Now())
	if err != nil {
		t.Fatalf("GenerateCode: %v", err)
	}
	if !s.Validate(code, secret) {
		t.Error("Validate should accept a valid generated code")
	}
}

func TestTOTPService_Validate_InvalidCode(t *testing.T) {
	s, _ := NewTOTPService([]byte(testKey))
	secret, _ := s.GenerateSecret("user-1")
	if s.Validate("000000", secret) {
		t.Error("Validate should reject wrong code")
	}
}

func TestTOTPService_Validate_InvalidSecret(t *testing.T) {
	s, _ := NewTOTPService([]byte(testKey))
	// malformed base32 secret
	if s.Validate("123456", "!!!not-base32!!!") {
		t.Error("Validate should return false for malformed secret")
	}
}

func TestTOTPService_EncryptDecrypt_RoundTrip(t *testing.T) {
	s, _ := NewTOTPService([]byte(testKey))
	enc, err := s.Encrypt("S3CRET")
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	got, err := s.Decrypt(enc)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if got != "S3CRET" {
		t.Errorf("Decrypt = %q, want S3CRET", got)
	}
}

func TestTOTPService_Encrypt_ProducesUniqueNonce(t *testing.T) {
	s, _ := NewTOTPService([]byte(testKey))
	e1, _ := s.Encrypt("same")
	e2, _ := s.Encrypt("same")
	// GCM nonce differs each call -> ciphertexts differ
	if string(e1) == string(e2) {
		t.Error("expected different ciphertexts due to random nonce")
	}
}

func TestTOTPService_Decrypt_Tampered(t *testing.T) {
	s, _ := NewTOTPService([]byte(testKey))
	enc, _ := s.Encrypt("secret")
	enc[0] ^= 0xff // corrupt first byte (nonce)
	if _, err := s.Decrypt(enc); err == nil {
		t.Error("expected error on tampered ciphertext")
	}
}

func TestTOTPService_Decrypt_TooShort(t *testing.T) {
	s, _ := NewTOTPService([]byte(testKey))
	if _, err := s.Decrypt([]byte{1, 2, 3}); err == nil {
		t.Error("expected error for data shorter than nonce size")
	}
}

func TestOTPAuthURI(t *testing.T) {
	got := OTPAuthURI("KTC", "admin", "JBSWY3DPEHPK3PXP")
	for _, want := range []string{
		"otpauth://totp/",
		"KTC",
		"admin",
		"JBSWY3DPEHPK3PXP",
		"algorithm=SHA1",
		"digits=6",
		"period=30",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("uri %q missing %q", got, want)
		}
	}
}
