package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

type HTTPAssessmentClient struct {
	url    string
	client *http.Client
}

func NewHTTPAssessmentClient(url string) *HTTPAssessmentClient {
	return &HTTPAssessmentClient{url: url, client: &http.Client{Timeout: 10 * time.Second}}
}

func (c *HTTPAssessmentClient) SendEvent(ctx context.Context, sessionID, scenarioID, eventType string, data any) error {
	event, err := buildAssessmentEvent(sessionID, eventType, data)
	if err != nil {
		return fmt.Errorf("assessment send event: %w", err)
	}
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("assessment send event: marshal: %w", err)
	}

	endpoint := c.url + "/assessment/event"
	if scenarioID != "" {
		endpoint += "?scenario_id=" + url.QueryEscape(scenarioID)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
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

// buildAssessmentEvent flattens orchestrator domain events into AssessmentEvent fields.
// Alarm events use raised_model_time; assessment expects model_time.
func buildAssessmentEvent(sessionID, eventType string, data any) (map[string]any, error) {
	raw, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	fields := map[string]any{}
	if len(raw) > 0 && string(raw) != "null" {
		if err := json.Unmarshal(raw, &fields); err != nil {
			return nil, err
		}
	}
	fields["session_id"] = sessionID
	fields["type"] = eventType
	if _, ok := fields["model_time"]; !ok {
		if raised, ok := fields["raised_model_time"]; ok {
			fields["model_time"] = raised
		}
	}
	return fields, nil
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
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("assessment get score: decode: %w", err)
	}
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
