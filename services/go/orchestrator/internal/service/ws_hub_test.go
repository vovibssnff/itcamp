package service

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

func TestBroadcastAlarm_UsesAlarmKey(t *testing.T) {
	hub := NewWSHub()
	client := NewWSClient("operator", "u1")
	hub.Register("sess-1", client)
	defer hub.Unregister("sess-1", client)

	hub.BroadcastAlarm("sess-1", alarmForWS(domain.AlarmEvent{
		ID:              "a1",
		TagID:           "PRC-313",
		Priority:        "HH",
		RaisedModelTime: 12,
	}))

	select {
	case raw := <-client.SendChan():
		var msg map[string]any
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatal(err)
		}
		if msg["type"] != "alarm" {
			t.Fatalf("type=%v", msg["type"])
		}
		if _, ok := msg["data"]; ok {
			t.Fatal("expected no data key — SPA reads msg.alarm")
		}
		alarm, ok := msg["alarm"].(map[string]any)
		if !ok {
			t.Fatalf("alarm payload missing: %v", msg)
		}
		if alarm["id"] != "a1" || alarm["tag"] != "PRC-313" || alarm["level"] != "HH" {
			t.Fatalf("unexpected alarm shape: %v", alarm)
		}
	case <-time.After(time.Second):
		t.Fatal("no message received")
	}
}

func TestBroadcastTelemetry_UsesTagsKey(t *testing.T) {
	hub := NewWSHub()
	client := NewWSClient("operator", "u1")
	hub.Register("sess-1", client)
	defer hub.Unregister("sess-1", client)

	tags := tagsForWS([]domain.Tag{{TagID: "TI-201", Value: 120, Unit: "°C"}}, 5, nil)
	hub.BroadcastTelemetry("sess-1", tags)

	select {
	case raw := <-client.SendChan():
		var msg map[string]any
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatal(err)
		}
		if msg["type"] != "telemetry" {
			t.Fatalf("type=%v", msg["type"])
		}
		if _, ok := msg["data"]; ok {
			t.Fatal("expected no data key — SPA reads msg.tags")
		}
		list, ok := msg["tags"].([]any)
		if !ok || len(list) != 1 {
			t.Fatalf("tags payload missing: %v", msg)
		}
	case <-time.After(time.Second):
		t.Fatal("no message received")
	}
}

func TestAlarmForWS_MapsFields(t *testing.T) {
	out := alarmForWS(domain.AlarmEvent{
		ID: "x", TagID: "LI-101", Priority: "LL", RaisedModelTime: 3,
	})
	if out["id"] != "x" || out["tag"] != "LI-101" || out["level"] != "LL" {
		t.Fatalf("%v", out)
	}
	if out["acknowledged"] != false {
		t.Fatal("expected unacked")
	}
}
