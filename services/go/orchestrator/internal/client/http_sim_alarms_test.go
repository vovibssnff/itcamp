package client

import (
	"encoding/json"
	"testing"
)

func TestParseWorkerAlarms_ListAndMap(t *testing.T) {
	listRaw := json.RawMessage(`[{"alarm_id":"AL-1","tag_id":"FRCA 428","priority":"L","raised_at_s":12}]`)
	got := parseWorkerAlarms(listRaw)
	if len(got) != 1 || got[0].AlarmID != "AL-1" || got[0].TagID != "FRCA 428" || got[0].Priority != "L" {
		t.Fatalf("list parse: %+v", got)
	}

	mapRaw := json.RawMessage(`{"FRCA 428:L":{"tag_id":"FRCA 428","priority":"L","raised_at_s":9}}`)
	got = parseWorkerAlarms(mapRaw)
	if len(got) != 1 || got[0].TagID != "FRCA 428" || got[0].Priority != "L" {
		t.Fatalf("map parse: %+v", got)
	}
	if got[0].AlarmID == "" {
		t.Fatal("expected map key used as alarm id fallback")
	}
}

func TestWorkerState_ToDomainAttachesAlarms(t *testing.T) {
	st := workerState{
		SessionID:  "s1",
		ModelTimeS: 10,
		TagValues:  map[string]float64{"FRCA 428": 12},
		ActiveAlarms: json.RawMessage(
			`[{"alarm_id":"AL-9","tag_id":"FRCA 428","priority":"L","raised_at_s":8}]`,
		),
	}
	dom := st.toDomain("s1")
	if len(dom.Alarms) != 1 || dom.Alarms[0].ID != "AL-9" || dom.Alarms[0].Priority != "L" {
		t.Fatalf("%+v", dom.Alarms)
	}
}

func TestWorkerState_ToDomainUsesRealSPAndOUT(t *testing.T) {
	st := workerState{
		SessionID:  "s1",
		ModelTimeS: 10,
		TagValues: map[string]float64{
			"LRCA 602": 55.0,
		},
		ControllerModes: map[string]string{
			"LRCA 602": "AUTO",
		},
		ControllerSetpoints: map[string]float64{
			"LRCA 602": 60.0,
		},
		ControllerOutputs: map[string]float64{
			"LRCA 602": 42.5,
		},
	}
	dom := st.toDomain("s1")
	if len(dom.Regulators) != 1 {
		t.Fatalf("regs: %+v", dom.Regulators)
	}
	r := dom.Regulators[0]
	if r.TagID != "LRCA 602" || r.PV != 55.0 || r.SP != 60.0 || r.OUT != 42.5 || r.Mode != "AUTO" {
		t.Fatalf("got %+v", r)
	}
}

func TestWorkerState_ToDomainDoesNotFabricateSPEqualsPV(t *testing.T) {
	// Missing SP/OUT maps: SP may fall back to PV for display, but OUT must not
	// equal PV (that made faceplates snap SP/OUT to process value after SET_SP).
	st := workerState{
		SessionID:       "s1",
		ModelTimeS:      1,
		TagValues:       map[string]float64{"PRCA 351": 3.2},
		ControllerModes: map[string]string{"PRCA 351": "MANUAL"},
	}
	dom := st.toDomain("s1")
	if len(dom.Regulators) != 1 {
		t.Fatalf("regs: %+v", dom.Regulators)
	}
	r := dom.Regulators[0]
	if r.OUT == r.PV {
		t.Fatalf("OUT must not be fabricated as PV when worker omits outputs: %+v", r)
	}
	if r.Mode != "MANUAL" {
		t.Fatalf("mode: %+v", r)
	}
}
