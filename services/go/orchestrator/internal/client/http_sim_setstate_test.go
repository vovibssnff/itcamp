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

func TestHTTPSimClient_SetState_SendsInternalState(t *testing.T) {
	var got map[string]json.RawMessage
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut || r.URL.Path != "/v1/sessions/sess-1/state" {
			t.Fatalf("unexpected %s %s", r.Method, r.URL.Path)
		}
		raw, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(raw, &got); err != nil {
			t.Fatalf("body: %v", err)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"session_id":"sess-1","model_time_s":10,"tag_values":{}}`))
	}))
	defer srv.Close()

	c := NewHTTPSimClient(srv.URL)
	err := c.SetState(context.Background(), "sess-1", domain.SimState{
		ModelTime:       10,
		ComponentsState: `{"pumps":{"P-101":{"state":"STOPPED","flow_multiplier":0}}}`,
		Tags:            []domain.Tag{{TagID: "should-not-override", Value: 99}},
	})
	if err != nil {
		t.Fatalf("SetState: %v", err)
	}
	if _, ok := got["tag_overrides"]; ok {
		t.Fatalf("tag_overrides must not be sent when internal_state is present: %v", got)
	}
	var internal map[string]any
	if err := json.Unmarshal(got["internal_state"], &internal); err != nil {
		t.Fatalf("internal_state: %v", err)
	}
	pumps, _ := internal["pumps"].(map[string]any)
	if pumps["P-101"] == nil {
		t.Fatalf("expected pump snapshot, got %v", internal)
	}
	var mt float64
	_ = json.Unmarshal(got["model_time_s"], &mt)
	if mt != 10 {
		t.Fatalf("model_time_s=%v", mt)
	}
}

func TestHTTPSimClient_SetState_FallsBackToTagOverrides(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &got)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()

	c := NewHTTPSimClient(srv.URL)
	err := c.SetState(context.Background(), "sess-1", domain.SimState{
		ModelTime: 1,
		Tags:      []domain.Tag{{TagID: "PRSA 204", Value: 2.5}},
	})
	if err != nil {
		t.Fatalf("SetState: %v", err)
	}
	if _, ok := got["internal_state"]; ok {
		t.Fatalf("unexpected internal_state: %v", got)
	}
	overrides, _ := got["tag_overrides"].(map[string]any)
	if overrides["PRSA 204"] != 2.5 {
		t.Fatalf("overrides=%v", overrides)
	}
}
