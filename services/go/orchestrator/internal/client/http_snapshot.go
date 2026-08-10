package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

type HTTPSnapshotClient struct {
	url    string
	client *http.Client
}

func NewHTTPSnapshotClient(url string) *HTTPSnapshotClient {
	return &HTTPSnapshotClient{url: url, client: &http.Client{Timeout: 30 * time.Second}}
}

func (c *HTTPSnapshotClient) Save(ctx context.Context, sessionID, name string, isPreset bool, state domain.SimState) (string, string, error) {
	stateJSON, err := json.Marshal(state)
	if err != nil {
		return "", "", fmt.Errorf("snapshot save: marshal state: %w", err)
	}
	payload, err := json.Marshal(map[string]any{
		"session_id":     sessionID,
		"name":           name,
		"is_preset":      isPreset,
		"schema_version": state.SchemaVersion,
		"model_time":     state.ModelTime,
		"seed":           state.Seed,
		// Snapshot service decodes payload_json as []byte (JSON base64), not a nested object.
		"payload_json": stateJSON,
	})
	if err != nil {
		return "", "", fmt.Errorf("snapshot save: marshal request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url+"/snapshots/save", bytes.NewReader(payload))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("snapshot save: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return "", "", fmt.Errorf("snapshot save: status %d", resp.StatusCode)
	}
	var result struct {
		SnapshotID string `json:"snapshot_id"`
		SHA256     string `json:"sha256"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", fmt.Errorf("snapshot save: decode response: %w", err)
	}
	if result.SnapshotID == "" {
		return "", "", fmt.Errorf("snapshot save: empty snapshot_id")
	}
	return result.SnapshotID, result.SHA256, nil
}

func (c *HTTPSnapshotClient) Restore(ctx context.Context, snapshotID string) (domain.SimState, error) {
	payload, err := json.Marshal(map[string]string{"snapshot_id": snapshotID})
	if err != nil {
		return domain.SimState{}, fmt.Errorf("snapshot restore: marshal request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url+"/snapshots/restore", bytes.NewReader(payload))
	if err != nil {
		return domain.SimState{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return domain.SimState{}, fmt.Errorf("snapshot restore: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return domain.SimState{}, fmt.Errorf("snapshot restore: status %d", resp.StatusCode)
	}
	var result struct {
		PayloadJSON   []byte  `json:"payload_json"`
		ModelTime     float64 `json:"model_time"`
		Seed          int64   `json:"seed"`
		SHA256Valid   bool    `json:"sha256_valid"`
		SchemaVersion string  `json:"schema_version"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return domain.SimState{}, fmt.Errorf("snapshot restore: decode response: %w", err)
	}
	if !result.SHA256Valid {
		return domain.SimState{}, fmt.Errorf("snapshot restore: sha256 mismatch")
	}
	if len(result.PayloadJSON) == 0 {
		return domain.SimState{}, fmt.Errorf("snapshot restore: empty payload")
	}
	var state domain.SimState
	if err := json.Unmarshal(result.PayloadJSON, &state); err != nil {
		return domain.SimState{}, fmt.Errorf("snapshot restore: decode payload: %w", err)
	}
	if state.ModelTime == 0 {
		state.ModelTime = result.ModelTime
	}
	if state.Seed == 0 {
		state.Seed = result.Seed
	}
	if state.SchemaVersion == "" {
		state.SchemaVersion = result.SchemaVersion
	}
	return state, nil
}
