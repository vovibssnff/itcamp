package client

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

// maxResponseBytes ограничивает размер читаемого ответа upstream (16 МБ).
const maxResponseBytes = 16 << 20

type HTTPScenarioClient struct {
	url    string
	client *http.Client
}

func NewHTTPScenarioClient(url string) *HTTPScenarioClient {
	return &HTTPScenarioClient{url: url, client: &http.Client{Timeout: 10 * time.Second}}
}

func (c *HTTPScenarioClient) GetFullScenario(ctx context.Context, scenarioID string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url+"/scenarios/"+scenarioID+"/full", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("scenario get full: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("scenario get full: status %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
}

func (c *HTTPScenarioClient) GetRandomExam(ctx context.Context, templateID string) ([]byte, error) {
	url := c.url + "/scenarios/exam?template_id=" + templateID
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("scenario get exam: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("scenario get exam: status %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
}
