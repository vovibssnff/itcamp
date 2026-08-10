package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type HTTPAssessmentClient struct {
	url    string
	client *http.Client
}

func NewHTTPAssessmentClient(url string) *HTTPAssessmentClient {
	return &HTTPAssessmentClient{url: url, client: &http.Client{Timeout: 10 * time.Second}}
}

func (c *HTTPAssessmentClient) SendEvent(ctx context.Context, sessionID, eventType string, data any) error {
	payload, _ := json.Marshal(map[string]any{
		"session_id": sessionID,
		"type":       eventType,
		"data":       data,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url+"/assessment/event", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("assessment send event: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("assessment send event: status %d", resp.StatusCode)
	}
	return nil
}

func (c *HTTPAssessmentClient) GetScore(ctx context.Context, sessionID string) (any, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url+"/assessment/session/"+sessionID+"/score", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("assessment get score: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("assessment get score: status %d", resp.StatusCode)
	}
	var result any
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

func (c *HTTPAssessmentClient) Finalize(ctx context.Context, sessionID string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url+"/assessment/session/"+sessionID+"/result", nil)
	if err != nil {
		return err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("assessment finalize: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("assessment finalize: status %d", resp.StatusCode)
	}
	return nil
}
