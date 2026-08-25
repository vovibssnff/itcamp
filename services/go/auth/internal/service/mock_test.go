package service

import (
	"context"
	"sync"

	"github.com/itcamp/ktc/services/auth/internal/domain"
)

type mockRefreshStore struct {
	mu     sync.Mutex
	tokens map[string]domain.RefreshToken
}

func newMockRefreshStore() *mockRefreshStore {
	return &mockRefreshStore{tokens: make(map[string]domain.RefreshToken)}
}

func (m *mockRefreshStore) Create(_ context.Context, t domain.RefreshToken) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.tokens[t.TokenHash] = t
	return nil
}

func (m *mockRefreshStore) GetByHash(_ context.Context, hash string) (domain.RefreshToken, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	t, ok := m.tokens[hash]
	if !ok {
		return domain.RefreshToken{}, domain.ErrTokenRevoked
	}
	return t, nil
}

func (m *mockRefreshStore) Revoke(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for k, t := range m.tokens {
		if t.ID == id {
			t.Revoked = true
			m.tokens[k] = t
		}
	}
	return nil
}

func (m *mockRefreshStore) RevokeAndReplace(_ context.Context, oldID, newID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for k, t := range m.tokens {
		if t.ID == oldID && !t.Revoked {
			t.Revoked = true
			t.ReplacedBy = newID
			m.tokens[k] = t
			return nil
		}
	}
	return domain.ErrTokenRevoked
}

func (m *mockRefreshStore) RevokeAllForUser(_ context.Context, userID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for k, t := range m.tokens {
		if t.UserID == userID {
			t.Revoked = true
			m.tokens[k] = t
		}
	}
	return nil
}

type mockUserLookup struct {
	user  domain.User
	roles []domain.Role
	err   error
}

func (m *mockUserLookup) GetByID(_ context.Context, _ string) (domain.User, error) {
	if m.err != nil {
		return domain.User{}, m.err
	}
	return m.user, nil
}

func (m *mockUserLookup) GetRoles(_ context.Context, _ string) ([]domain.Role, error) {
	if m.err != nil {
		return nil, m.err
	}
	if m.roles != nil {
		return m.roles, nil
	}
	return m.user.Roles, nil
}
