package client

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPSnapshotClient_Restore_RejectsSHAMismatch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"payload_json": map[string]any{"session_id": "s1", "model_time": 5},
			"sha256_valid": false,
		})
	}))
	defer srv.Close()

	c := NewHTTPSnapshotClient(srv.URL)
	_, err := c.Restore(context.Background(), "snap-1")
	if err == nil {
		t.Fatal("expected sha256 mismatch error")
	}
}

func TestHTTPSnapshotClient_Restore_KeepsComponentsState(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"payload_json": map[string]any{
				"session_id":             "s1",
				"model_time":             12,
				"components_state_json":  `{"pumps":{"P-1":{"state":"RUNNING","flow_multiplier":1}}}`,
			},
			"sha256_valid": true,
		})
	}))
	defer srv.Close()

	c := NewHTTPSnapshotClient(srv.URL)
	state, err := c.Restore(context.Background(), "snap-1")
	if err != nil {
		t.Fatalf("Restore: %v", err)
	}
	if state.ModelTime != 12 {
		t.Fatalf("model_time=%v", state.ModelTime)
	}
	if state.ComponentsState == "" || state.ComponentsState == "null" {
		t.Fatalf("components_state missing: %q", state.ComponentsState)
	}
}
