package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

// HTTPSimClient talks to sim-worker REST Model API (compose: http://sim-worker:8081).
type HTTPSimClient struct {
	base   string
	client *http.Client
}

func NewHTTPSimClient(baseURL string) *HTTPSimClient {
	return &HTTPSimClient{
		base:   trimTrailingSlash(baseURL),
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

func trimTrailingSlash(s string) string {
	for len(s) > 0 && s[len(s)-1] == '/' {
		s = s[:len(s)-1]
	}
	return s
}

func (c *HTTPSimClient) CreateSession(ctx context.Context, sessionID string, initState []byte, seed int64) error {
	if seed == 0 && len(initState) > 0 {
		var meta struct {
			Seed int64 `json:"seed"`
		}
		_ = json.Unmarshal(initState, &meta)
		if meta.Seed != 0 {
			seed = meta.Seed
		}
	}
	payload, _ := json.Marshal(map[string]any{
		"session_id": sessionID,
		"seed":       seed,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/v1/sessions", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("sim create session: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusConflict {
		// Idempotent: session already exists on shared worker.
		return nil
	}
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("sim create session: status %d: %s", resp.StatusCode, string(body))
	}
	// Best-effort: apply tag overrides from constructor export if present.
	c.applyInitTags(ctx, sessionID, initState)
	return nil
}

func (c *HTTPSimClient) applyInitTags(ctx context.Context, sessionID string, initState []byte) {
	if len(initState) == 0 {
		return
	}
	var export struct {
		Tags []struct {
			TagID string  `json:"tag_id"`
			Value float64 `json:"value"`
		} `json:"tags"`
	}
	if err := json.Unmarshal(initState, &export); err != nil || len(export.Tags) == 0 {
		return
	}
	overrides := make(map[string]float64, len(export.Tags))
	for _, t := range export.Tags {
		if t.TagID != "" {
			overrides[t.TagID] = t.Value
		}
	}
	if len(overrides) == 0 {
		return
	}
	payload, _ := json.Marshal(map[string]any{"tag_overrides": overrides})
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, c.base+"/v1/sessions/"+sessionID+"/state", bytes.NewReader(payload))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return
	}
	_ = resp.Body.Close()
}

func (c *HTTPSimClient) DestroySession(ctx context.Context, sessionID string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, c.base+"/v1/sessions/"+sessionID, nil)
	if err != nil {
		return err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("sim destroy session: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 && resp.StatusCode != http.StatusNotFound {
		return fmt.Errorf("sim destroy session: status %d", resp.StatusCode)
	}
	return nil
}

func (c *HTTPSimClient) Step(ctx context.Context, sessionID string, ticks int32) (domain.SimState, error) {
	if ticks <= 0 {
		ticks = 1
	}
	payload, _ := json.Marshal(map[string]any{"real_dt_s": float64(ticks)})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/v1/sessions/"+sessionID+"/step", bytes.NewReader(payload))
	if err != nil {
		return domain.SimState{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return domain.SimState{}, fmt.Errorf("sim step: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return domain.SimState{}, fmt.Errorf("%w: step status %d", domain.ErrSimUnavailable, resp.StatusCode)
	}
	var result struct {
		State workerState `json:"state"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return domain.SimState{}, fmt.Errorf("sim step decode: %w", err)
	}
	return result.State.toDomain(sessionID), nil
}

func (c *HTTPSimClient) GetState(ctx context.Context, sessionID string) (domain.SimState, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base+"/v1/sessions/"+sessionID+"/state", nil)
	if err != nil {
		return domain.SimState{}, err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return domain.SimState{}, fmt.Errorf("sim get state: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return domain.SimState{}, fmt.Errorf("%w: get state status %d", domain.ErrSimUnavailable, resp.StatusCode)
	}
	var st workerState
	if err := json.NewDecoder(resp.Body).Decode(&st); err != nil {
		return domain.SimState{}, fmt.Errorf("sim get state decode: %w", err)
	}
	return st.toDomain(sessionID), nil
}

func (c *HTTPSimClient) SetState(ctx context.Context, sessionID string, state domain.SimState) error {
	overrides := make(map[string]float64, len(state.Tags))
	for _, t := range state.Tags {
		overrides[t.TagID] = t.Value
	}
	payload, _ := json.Marshal(map[string]any{
		"tag_overrides": overrides,
		"model_time_s":  state.ModelTime,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, c.base+"/v1/sessions/"+sessionID+"/state", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("sim set state: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("sim set state: status %d", resp.StatusCode)
	}
	return nil
}

func (c *HTTPSimClient) InjectFault(ctx context.Context, fault domain.InjectFaultReq) error {
	mag := fault.SeverityPct / 100.0
	if mag <= 0 {
		mag = 1.0
	}
	payload, _ := json.Marshal(map[string]any{
		"fault_id":  fault.FaultID,
		"magnitude": mag,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/v1/sessions/"+fault.SessionID+"/faults", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("sim inject fault: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("sim inject fault: status %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

func (c *HTTPSimClient) SetSpeed(ctx context.Context, sessionID string, factor float64) error {
	payload, _ := json.Marshal(map[string]any{"multiplier": factor})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/v1/sessions/"+sessionID+"/speed", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("sim set speed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("sim set speed: status %d", resp.StatusCode)
	}
	return nil
}

type workerState struct {
	SessionID    string             `json:"session_id"`
	ModelTimeS   float64            `json:"model_time_s"`
	TagValues    map[string]float64 `json:"tag_values"`
	ActiveAlarms []struct {
		AlarmID   string   `json:"alarm_id"`
		TagID     string   `json:"tag_id"`
		Priority  string   `json:"priority"`
		RaisedAtS float64  `json:"raised_at_s"`
		AckAtS    *float64 `json:"ack_at_s"`
	} `json:"active_alarms"`
}

func (s workerState) toDomain(sessionID string) domain.SimState {
	if s.SessionID != "" {
		sessionID = s.SessionID
	}
	tags := make([]domain.Tag, 0, len(s.TagValues))
	for id, v := range s.TagValues {
		tags = append(tags, domain.Tag{TagID: id, Value: v, Quality: "good"})
	}
	alarms := make([]domain.AlarmEvent, 0, len(s.ActiveAlarms))
	for _, a := range s.ActiveAlarms {
		alarms = append(alarms, domain.AlarmEvent{
			ID:              a.AlarmID,
			SessionID:       sessionID,
			TagID:           a.TagID,
			Priority:        a.Priority,
			RaisedModelTime: a.RaisedAtS,
			AckModelTime:    a.AckAtS,
		})
	}
	return domain.SimState{
		SessionID: sessionID,
		ModelTime: s.ModelTimeS,
		Tags:      tags,
		Alarms:    alarms,
	}
}
