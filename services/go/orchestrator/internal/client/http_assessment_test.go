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

func TestHTTPAssessmentClient_SendEvent_FlattensAction(t *testing.T) {
	var gotPath string
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.String()
		raw, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(raw, &got); err != nil {
			t.Fatalf("body: %v", err)
		}
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()

	c := NewHTTPAssessmentClient(srv.URL)
	action := domain.OperatorAction{
		SessionID: "sess-1",
		UserID:    "u1",
		Type:      "actuator",
		Target:    "TRC-3",
		Action:    "decrease",
		Value:     1.5,
		ModelTime: 110,
	}
	if err := c.SendEvent(context.Background(), "sess-1", "scen-9", "action", action); err != nil {
		t.Fatalf("SendEvent: %v", err)
	}
	if gotPath != "/assessment/event?scenario_id=scen-9" {
		t.Fatalf("unexpected path %s", gotPath)
	}
	if got["type"] != "action" {
		t.Fatalf("expected type=action, got %v", got["type"])
	}
	if got["target"] != "TRC-3" || got["action"] != "decrease" {
		t.Fatalf("action fields not flattened: %+v", got)
	}
	if _, nested := got["data"]; nested {
		t.Fatalf("event must not nest under data: %+v", got)
	}
	if got["model_time"].(float64) != 110 {
		t.Fatalf("model_time=%v", got["model_time"])
	}
}

func TestHTTPAssessmentClient_SendEvent_MapsAlarmModelTime(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &got)
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()

	c := NewHTTPAssessmentClient(srv.URL)
	alarm := domain.AlarmEvent{
		SessionID:       "sess-1",
		TagID:           "PRSA-204",
		Priority:        "H",
		RaisedModelTime: 99.5,
	}
	if err := c.SendEvent(context.Background(), "sess-1", "scen-1", "alarm", alarm); err != nil {
		t.Fatalf("SendEvent: %v", err)
	}
	if got["type"] != "alarm" || got["tag_id"] != "PRSA-204" {
		t.Fatalf("unexpected alarm event: %+v", got)
	}
	if got["model_time"].(float64) != 99.5 {
		t.Fatalf("expected raised_model_time mapped to model_time, got %v", got["model_time"])
	}
}

func TestBuildAssessmentEvent_OverridesType(t *testing.T) {
	event, err := buildAssessmentEvent("sess-1", "action", domain.OperatorAction{
		Type:   "actuator",
		Target: "X",
		Action: "set",
	})
	if err != nil {
		t.Fatal(err)
	}
	if event["type"] != "action" {
		t.Fatalf("type should be assessment event type, got %v", event["type"])
	}
	if event["session_id"] != "sess-1" {
		t.Fatalf("session_id=%v", event["session_id"])
	}
}
