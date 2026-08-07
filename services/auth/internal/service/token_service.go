package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/itcamp/ktc/services/auth/internal/config"
	"github.com/itcamp/ktc/services/auth/internal/domain"
	"github.com/itcamp/ktc/services/auth/internal/repository"
)

type TokenService struct {
	cfg      config.JWTConfig
	refresh  *repository.RefreshRepo
}

func NewTokenService(cfg config.JWTConfig, refresh *repository.RefreshRepo) *TokenService {
	return &TokenService{cfg: cfg, refresh: refresh}
}

func (s *TokenService) Issue(ctx context.Context, user domain.User) (domain.TokenPair, error) {
	access, accessID, err := s.signAccess(user)
	if err != nil {
		return domain.TokenPair{}, err
	}

	refreshPlain, err := s.randomToken()
	if err != nil {
		return domain.TokenPair{}, err
	}

	now := time.Now().UTC()
	rt := domain.RefreshToken{
		ID:        accessID,
		UserID:    user.ID,
		TokenHash: hashToken(refreshPlain),
		IssuedAt:  now,
		ExpiresAt: now.Add(s.cfg.RefreshTTL.Std()),
		Revoked:   false,
	}
	if err := s.refresh.Create(ctx, rt); err != nil {
		return domain.TokenPair{}, fmt.Errorf("persist refresh: %w", err)
	}

	return domain.TokenPair{
		AccessToken:  access,
		RefreshToken: refreshPlain,
		AccessTTL:    s.cfg.AccessTTL.Std(),
		RefreshTTL:   s.cfg.RefreshTTL.Std(),
	}, nil
}

func (s *TokenService) Refresh(ctx context.Context, refreshPlain string) (domain.TokenPair, error) {
	hash := hashToken(refreshPlain)

	stored, err := s.refresh.GetByHash(ctx, hash)
	if err != nil {
		if errors.Is(err, domain.ErrTokenRevoked) {
			return domain.TokenPair{}, domain.ErrTokenRevoked
		}
		return domain.TokenPair{}, domain.ErrTokenInvalid
	}
	if stored.Revoked {
		return domain.TokenPair{}, domain.ErrTokenRevoked
	}
	if time.Now().UTC().After(stored.ExpiresAt) {
		return domain.TokenPair{}, domain.ErrTokenExpired
	}

	claims, err := s.parseAccess(stored.ID)
	if err != nil {
		return domain.TokenPair{}, domain.ErrTokenInvalid
	}

	user := domain.User{ID: claims.UserID, Login: claims.Login, Roles: claims.Roles}
	newPair, err := s.Issue(ctx, user)
	if err != nil {
		return domain.TokenPair{}, err
	}

	if err := s.refresh.RevokeAndReplace(ctx, stored.ID, newPair.AccessToken); err != nil {
		return domain.TokenPair{}, domain.ErrTokenRevoked
	}
	return newPair, nil
}

func (s *TokenService) Revoke(ctx context.Context, refreshPlain string) error {
	hash := hashToken(refreshPlain)
	return s.refresh.Revoke(ctx, hash)
}

func (s *TokenService) RevokeAllForUser(ctx context.Context, userID string) error {
	return s.refresh.RevokeAllForUser(ctx, userID)
}

func (s *TokenService) Introspect(ctx context.Context, accessToken string) (domain.IntrospectionResult, error) {
	claims, err := s.parseAccess(accessToken)
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return domain.IntrospectionResult{Active: false}, domain.ErrTokenExpired
		}
		return domain.IntrospectionResult{Active: false}, domain.ErrTokenInvalid
	}
	return domain.IntrospectionResult{Active: true, Claims: claims}, nil
}

func (s *TokenService) signAccess(user domain.User) (string, string, error) {
	now := time.Now().UTC()
	tokenID, err := s.randomToken()
	if err != nil {
		return "", "", err
	}
	claims := jwt.MapClaims{
		"uid":   user.ID,
		"login": user.Login,
		"roles": user.Roles,
		"jti":   tokenID,
		"iss":   s.cfg.Issuer,
		"iat":   now.Unix(),
		"exp":   now.Add(s.cfg.AccessTTL.Std()).Unix(),
	}
	token := jwt.NewWithClaims(jwt.GetSigningMethod(s.cfg.SigningMethod), claims)
	signed, err := token.SignedString([]byte(s.cfg.SigningKey))
	if err != nil {
		return "", "", fmt.Errorf("sign access: %w", err)
	}
	return signed, tokenID, nil
}

func (s *TokenService) parseAccess(tokenStr string) (*domain.Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &jwt.MapClaims{}, func(t *jwt.Token) (any, error) {
		if t.Method.Alg() != s.cfg.SigningMethod {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(s.cfg.SigningKey), nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, domain.ErrTokenInvalid
	}

	claims, ok := token.Claims.(*jwt.MapClaims)
	if !ok {
		return nil, domain.ErrTokenInvalid
	}

	result := &domain.Claims{}
	if v, ok := (*claims)["uid"].(string); ok {
		result.UserID = v
	}
	if v, ok := (*claims)["login"].(string); ok {
		result.Login = v
	}
	if v, ok := (*claims)["jti"].(string); ok {
		result.TokenID = v
	}
	if roles, ok := (*claims)["roles"].([]any); ok {
		for _, r := range roles {
			if rs, ok := r.(string); ok {
				result.Roles = append(result.Roles, domain.Role(rs))
			}
		}
	}
	return result, nil
}

func (s *TokenService) randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
