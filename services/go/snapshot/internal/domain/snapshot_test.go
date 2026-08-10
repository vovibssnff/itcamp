package domain

import (
	"encoding/json"
	"testing"
)

// Оркестратор шлёт payload_json объектом (см. orchestrator client.HTTPSnapshotClient.Save).
// При []byte encoding/json ждал бы base64 и падал бы с 500 — фиксируем контракт.
func TestSaveRequest_DecodesObjectPayload(t *testing.T) {
	body := `{
		"session_id": "s-1",
		"name": "snap-1",
		"is_preset": false,
		"schema_version": "2.0",
		"model_time": 42.5,
		"seed": 7,
		"payload_json": {"model_time": 42.5, "tags": {"PRC 313": 1.2}}
	}`

	var req SaveRequest
	if err := json.Unmarshal([]byte(body), &req); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if req.SessionID != "s-1" || req.Name != "snap-1" {
		t.Fatalf("unexpected meta: %+v", req)
	}
	if req.ModelTime != 42.5 || req.Seed != 7 {
		t.Fatalf("unexpected model_time/seed: %+v", req)
	}
	if len(req.PayloadJSON) == 0 {
		t.Fatal("payload must not be empty")
	}

	var payload map[string]any
	if err := json.Unmarshal(req.PayloadJSON, &payload); err != nil {
		t.Fatalf("payload is not raw JSON: %v", err)
	}
	if payload["model_time"] != 42.5 {
		t.Fatalf("payload lost fields: %+v", payload)
	}
}

// Restore должен возвращать состояние объектом, иначе оркестратор не распарсит SimState.
func TestRestoreResponse_EncodesObjectPayload(t *testing.T) {
	resp := RestoreResponse{
		PayloadJSON:   json.RawMessage(`{"model_time":10}`),
		ModelTime:     10,
		SHA256Valid:   true,
		SchemaVersion: "2.0",
	}

	out, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}

	var decoded struct {
		PayloadJSON struct {
			ModelTime float64 `json:"model_time"`
		} `json:"payload_json"`
	}
	if err := json.Unmarshal(out, &decoded); err != nil {
		t.Fatalf("payload_json must be an object, got %s: %v", out, err)
	}
	if decoded.PayloadJSON.ModelTime != 10 {
		t.Fatalf("unexpected payload: %s", out)
	}
}
