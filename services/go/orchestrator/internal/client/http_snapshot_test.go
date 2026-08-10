package client

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

func TestHTTPSnapshotClient_Save_SendsPayloadAsBytes(t *testing.T) {
	var gotBody map[string]json.RawMessage
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/snapshots/save" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		raw, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(raw, &gotBody); err != nil {
			t.Fatalf("request json: %v", err)
		}
		// Mimic snapshot service: payload_json must decode as []byte.
		var req struct {
			PayloadJSON []byte `json:"payload_json"`
		}
		if err := json.Unmarshal(raw, &req); err != nil {
			t.Fatalf("snapshot SaveRequest decode: %v", err)
		}
		if len(req.PayloadJSON) == 0 {
			t.Fatal("expected non-empty payload_json bytes")
		}
		var state domain.SimState
		if err := json.Unmarshal(req.PayloadJSON, &state); err != nil {
			t.Fatalf("payload contents: %v", err)
		}
		if state.SessionID != "sess-1" || state.ModelTime != 12.5 {
			t.Fatalf("unexpected state in payload: %+v", state)
		}
		_ = json.NewEncoder(w).Encode(map[string]string{
			"snapshot_id": "snap-1",
			"sha256":      "abc",
		})
	}))
	defer srv.Close()

	c := NewHTTPSnapshotClient(srv.URL)
	state := domain.SimState{
		SessionID: "sess-1",
		ModelTime: 12.5,
		Seed:      7,
		Tags:      []domain.Tag{{TagID: "T1", Value: 1}},
	}
	id, sha, err := c.Save(context.Background(), "sess-1", "cp1", false, state)
	if err != nil {
		t.Fatalf("Save: %v", err)
	}
	if id != "snap-1" || sha != "abc" {
		t.Fatalf("unexpected response id=%s sha=%s", id, sha)
	}
}

func TestHTTPSnapshotClient_Restore_UnmarshalsPayloadBytes(t *testing.T) {
	want := domain.SimState{
		SessionID:     "sess-1",
		ModelTime:     42,
		Seed:          9,
		SchemaVersion: "v1",
		Tags:          []domain.Tag{{TagID: "T1", Value: 3.14}},
		Regulators:    []domain.Regulator{{TagID: "R1", PV: 1}},
	}
	payload, err := json.Marshal(want)
	if err != nil {
		t.Fatal(err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"payload_json":   payload, // encodes as base64 string
			"model_time":     42.0,
			"seed":           int64(9),
			"sha256_valid":   true,
			"schema_version": "v1",
		})
	}))
	defer srv.Close()

	c := NewHTTPSnapshotClient(srv.URL)
	got, err := c.Restore(context.Background(), "snap-1")
	if err != nil {
		t.Fatalf("Restore: %v", err)
	}
	if got.SessionID != want.SessionID || got.ModelTime != want.ModelTime || len(got.Tags) != 1 || got.Tags[0].Value != 3.14 {
		t.Fatalf("restored state mismatch: %+v", got)
	}
	if len(got.Regulators) != 1 {
		t.Fatalf("expected regulators to be restored, got %+v", got)
	}
}

func TestHTTPSnapshotClient_Restore_RejectsInvalidSHA(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"payload_json": []byte(`{"session_id":"s"}`),
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
