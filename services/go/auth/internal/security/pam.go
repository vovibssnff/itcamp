package security

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/itcamp/ktc/services/auth/internal/config"
	"github.com/itcamp/ktc/services/auth/internal/domain"
)

type PAMClient struct {
	enabled  bool
	endpoint string
	client   *http.Client
}

func NewPAMClient(cfg config.PAMConfig) *PAMClient {
	return &PAMClient{
		enabled:  cfg.Enabled,
		endpoint: cfg.Endpoint,
		client:   &http.Client{Timeout: 5 * time.Second},
	}
}

type PAMVerifyRequest struct {
	UserID string `json:"user_id"`
	Token  string `json:"token"`
}

type PAMVerifyResponse struct {
	Valid bool `json:"valid"`
}

func (c *PAMClient) Verify(ctx context.Context, userID, token string) error {
	if !c.enabled {
		return nil
	}
	if c.endpoint == "" {
		return errors.New("pam endpoint is not configured")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint+"/verify", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", userID)
	req.Header.Set("X-Token", token)

	resp, err := c.client.Do(req)
	if err != nil {
		return domain.ErrLDAPUnavailable
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return domain.ErrInvalidCredentials
	}
	return nil
}

func (c *PAMClient) Enabled() bool {
	return c.enabled
}
