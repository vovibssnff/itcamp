package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base32"
	"errors"
	"io"
	"net/url"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"

	"github.com/itcamp/ktc/services/auth/internal/domain"
)

type TOTPService struct {
	encryptionKey []byte
}

func NewTOTPService(encryptionKey []byte) (*TOTPService, error) {
	if len(encryptionKey) != 32 {
		return nil, errors.New("encryption key must be 32 bytes (AES-256)")
	}
	return &TOTPService{encryptionKey: encryptionKey}, nil
}

func (s *TOTPService) GenerateSecret(userID string) (string, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "KTC",
		AccountName: userID,
		Period:      30,
		Digits:      otp.DigitsSix,
		Algorithm:   otp.AlgorithmSHA1,
	})
	if err != nil {
		return "", err
	}
	return key.Secret(), nil
}

// OTPAuthURI builds a standard otpauth:// URL for authenticator apps / QR codes.
func OTPAuthURI(issuer, accountName, secret string) string {
	label := url.PathEscape(issuer) + ":" + url.PathEscape(accountName)
	q := url.Values{}
	q.Set("secret", secret)
	q.Set("issuer", issuer)
	q.Set("algorithm", "SHA1")
	q.Set("digits", "6")
	q.Set("period", "30")
	return "otpauth://totp/" + label + "?" + q.Encode()
}

func (s *TOTPService) Validate(code, secret string) bool {
	valid, err := totp.ValidateCustom(code, secret, time.Now().UTC(), totp.ValidateOpts{
		Period:    30,
		Skew:      1,
		Digits:    otp.DigitsSix,
		Algorithm: otp.AlgorithmSHA1,
	})
	if err != nil {
		return false
	}
	return valid
}

func (s *TOTPService) ValidateNow(code, secret string) bool {
	return s.Validate(code, secret)
}

func (s *TOTPService) Encrypt(secret string) ([]byte, error) {
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, []byte(secret), nil), nil
}

func (s *TOTPService) Decrypt(encrypted []byte) (string, error) {
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(encrypted) < nonceSize {
		return "", domain.ErrTokenInvalid
	}
	nonce, ciphertext := encrypted[:nonceSize], encrypted[nonceSize:]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func EncodeBase32(data []byte) string {
	return base32.StdEncoding.EncodeToString(data)
}
