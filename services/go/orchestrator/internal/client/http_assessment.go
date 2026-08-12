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
	payload := map[string]any{
		"session_id": sessionID,
		"type":       eventType,
	}
	if data != nil {
		raw, _ := json.Marshal(data)
		var fields map[string]any
		if err := json.Unmarshal(raw, &fields); err == nil {
			for k, v := range fields {
				// OperatorAction/AlarmEvent carry their own "type"/time fields; never let
				// them clobber the assessment event type the caller requested.
				if k == "type" || k == "session_id" {
					continue
				}
				payload[k] = v
			}
			// AlarmEvent uses raised_model_time; assessment expects model_time.
			if _, ok := payload["model_time"]; !ok {
				if raised, ok := fields["raised_model_time"]; ok {
					payload["model_time"] = raised
				}
			}
		}
	}
	// Re-assert after merge so nested structs cannot change the event kind.
	payload["type"] = eventType
	payload["session_id"] = sessionID

	body, _ := json.Marshal(payload)
	urlStr := c.url + "/assessment/event"
	if scenarioID != "" {
		urlStr += "?scenario_id=" + url.QueryEscape(scenarioID)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, urlStr, bytes.NewReader(body))
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

func (c *HTTPAssessmentClient) CheckMissedSteps(ctx context.Context, sessionID string, modelTime float64) error {
	payload, _ := json.Marshal(map[string]any{"model_time": modelTime})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url+"/assessment/session/"+sessionID+"/check-missed", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("assessment check missed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("assessment check missed: status %d", resp.StatusCode)
	}
	return nil
}
