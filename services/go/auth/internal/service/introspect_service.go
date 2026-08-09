package service

import (
	"context"

	"github.com/itcamp/ktc/services/auth/internal/domain"
)

type IntrospectService struct {
	token *TokenService
}

func NewIntrospectService(token *TokenService) *IntrospectService {
	return &IntrospectService{token: token}
}

func (s *IntrospectService) Introspect(ctx context.Context, accessToken string) (domain.IntrospectionResult, error) {
	return s.token.Introspect(ctx, accessToken)
}
