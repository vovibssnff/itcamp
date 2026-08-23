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
	payload, _ := json.Marshal(map[string]any{
		"session_id":     sessionID,
		"name":           name,
		"is_preset":      isPreset,
		"schema_version": state.SchemaVersion,
		"model_time":     state.ModelTime,
		"seed":           state.Seed,
		"payload_json":   state,
	})
	resp, err := c.client.Post(c.url+"/snapshots/save", "application/json", bytes.NewReader(payload))
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
		return "", "", fmt.Errorf("snapshot save: decode: %w", err)
	}
	return result.SnapshotID, result.SHA256, nil
}

func (c *HTTPSnapshotClient) Restore(ctx context.Context, snapshotID string) (domain.SimState, error) {
	payload, _ := json.Marshal(map[string]string{"snapshot_id": snapshotID})
	resp, err := c.client.Post(c.url+"/snapshots/restore", "application/json", bytes.NewReader(payload))
	if err != nil {
		return domain.SimState{}, fmt.Errorf("snapshot restore: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return domain.SimState{}, fmt.Errorf("snapshot restore: status %d", resp.StatusCode)
	}
	var result struct {
		PayloadJSON   domain.SimState `json:"payload_json"`
		ModelTime     float64         `json:"model_time"`
		Seed          int64           `json:"seed"`
		SHA256Valid   bool            `json:"sha256_valid"`
		SchemaVersion string          `json:"schema_version"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return domain.SimState{}, fmt.Errorf("snapshot restore: decode: %w", err)
	}
	if !result.SHA256Valid {
		return domain.SimState{}, fmt.Errorf("snapshot restore: sha256 mismatch")
	}
	state := result.PayloadJSON
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
