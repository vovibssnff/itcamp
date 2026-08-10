package client

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

type HTTPConstructorClient struct {
	url    string
	client *http.Client
}

func NewHTTPConstructorClient(url string) *HTTPConstructorClient {
	return &HTTPConstructorClient{url: url, client: &http.Client{Timeout: 15 * time.Second}}
}

func (c *HTTPConstructorClient) ExportTemplate(ctx context.Context, templateID string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url+"/templates/"+templateID+"/export", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("constructor export: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("constructor export: status %d", resp.StatusCode)
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("constructor export read: %w", err)
	}
	return data, nil
}
