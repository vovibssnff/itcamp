package client

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSendEvent_PreservesEventTypeAgainstOperatorAction(t *testing.T) {
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &gotBody)
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()

	c := NewHTTPAssessmentClient(srv.URL)
	op := map[string]any{
		"id":         "act-1",
		"session_id": "sess-1",
		"type":       "SET_MODE",
		"target":     "LRCA-641",
		"action":     "command",
		"value":      1.0,
		"model_time": 10.0,
	}
	if err := c.SendEvent(context.Background(), "sess-1", "sc-1", "action", op); err != nil {
		t.Fatalf("SendEvent: %v", err)
	}
	if gotBody["type"] != "action" {
		t.Fatalf("type = %#v, want action (must not be clobbered by OperatorAction.type)", gotBody["type"])
	}
	if gotBody["session_id"] != "sess-1" {
		t.Fatalf("session_id = %#v", gotBody["session_id"])
	}
	if gotBody["target"] != "LRCA-641" {
		t.Fatalf("target = %#v", gotBody["target"])
	}
}

func TestSendEvent_MapsRaisedModelTimeToModelTime(t *testing.T) {
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &gotBody)
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()

	c := NewHTTPAssessmentClient(srv.URL)
	alarm := map[string]any{
		"id":                "al-1",
		"session_id":        "sess-1",
		"tag_id":            "PRSA-204",
		"priority":          "H",
		"raised_model_time": 42.5,
	}
	if err := c.SendEvent(context.Background(), "sess-1", "sc-1", "alarm", alarm); err != nil {
		t.Fatalf("SendEvent: %v", err)
	}
	if gotBody["type"] != "alarm" {
		t.Fatalf("type = %#v, want alarm", gotBody["type"])
	}
	if gotBody["model_time"] != 42.5 {
		t.Fatalf("model_time = %#v, want 42.5 from raised_model_time", gotBody["model_time"])
	}
	if gotBody["tag_id"] != "PRSA-204" {
		t.Fatalf("tag_id = %#v", gotBody["tag_id"])
	}
}
