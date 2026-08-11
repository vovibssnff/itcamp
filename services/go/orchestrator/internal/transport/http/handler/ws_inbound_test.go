package handler

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
	"github.com/itcamp/ktc/services/orchestrator/internal/service"
)

func TestParseWSClientMessage_Actuator(t *testing.T) {
	route, err := parseWSClientMessage("operator", []byte(`{"type":"actuator","tag":"LRCA 602","value":42}`))
	if err != nil {
		t.Fatal(err)
	}
	if route.Kind != "actuator" || route.Tag != "LRCA 602" {
		t.Fatalf("route=%+v", route)
	}
	if v, ok := route.Value.(float64); !ok || v != 42 {
		t.Fatalf("value=%v", route.Value)
	}
}

func TestParseWSClientMessage_AckAlarm(t *testing.T) {
	route, err := parseWSClientMessage("operator", []byte(`{"type":"ack_alarm","id":"a-1"}`))
	if err != nil {
		t.Fatal(err)
	}
	if route.Kind != "ack_alarm" || route.AlarmID != "a-1" {
		t.Fatalf("route=%+v", route)
	}
}

func TestParseWSClientMessage_RegulatorAndESD(t *testing.T) {
	cases := []struct {
		raw     string
		cmdType string
		tag     string
		value   any
	}{
		{`{"type":"regulator_sp","tag":"FRC 408","sp":55}`, "SET_SP", "FRC 408", 55.0},
		{`{"type":"regulator_out","tag":"TRC 3","out":30}`, "SET_OUT", "TRC 3", 30.0},
		{`{"type":"regulator_mode","tag":"LRCA 602","mode":"manual"}`, "SET_MODE", "LRCA 602", 1.0},
		{`{"type":"esd","tag":"ESD-ATM"}`, "ESD", "ESD-ATM", nil},
	}
	for _, tc := range cases {
		route, err := parseWSClientMessage("operator", []byte(tc.raw))
		if err != nil {
			t.Fatalf("%s: %v", tc.raw, err)
		}
		if route.Kind != "command" || route.CmdType != tc.cmdType || route.Tag != tc.tag {
			t.Fatalf("%s → %+v", tc.raw, route)
		}
		if tc.value != nil && route.Value != tc.value {
			t.Fatalf("%s value=%v want %v", tc.raw, route.Value, tc.value)
		}
	}
}

func TestParseWSClientMessage_ObserverForbidden(t *testing.T) {
	_, err := parseWSClientMessage("observer", []byte(`{"type":"actuator","tag":"X","value":1}`))
	if !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("err=%v", err)
	}
}

func TestParseWSClientMessage_IgnoresPing(t *testing.T) {
	route, err := parseWSClientMessage("operator", []byte(`{"type":"ping"}`))
	if err != nil || !route.Ignore {
		t.Fatalf("route=%+v err=%v", route, err)
	}
}

func TestTelemetryConnectSnapshotShape(t *testing.T) {
	tags := service.TelemetryTagsForWS(domain.Telemetry{
		ModelTime: 12,
		Tags:      []domain.Tag{{TagID: "PRSA 204", Value: 2.7, Unit: "kgf/cm2"}},
	})
	msg := map[string]any{"type": "telemetry", "tags": tags}
	raw, err := json.Marshal(msg)
	if err != nil {
		t.Fatal(err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded["type"] != "telemetry" {
		t.Fatalf("type=%v", decoded["type"])
	}
	if _, ok := decoded["data"]; ok {
		t.Fatal("connect snapshot must not use data key")
	}
	list, ok := decoded["tags"].([]any)
	if !ok || len(list) != 1 {
		t.Fatalf("tags=%v", decoded["tags"])
	}
	first := list[0].(map[string]any)
	if first["tag"] != "PRSA 204" {
		t.Fatalf("tag=%v", first["tag"])
	}
}
