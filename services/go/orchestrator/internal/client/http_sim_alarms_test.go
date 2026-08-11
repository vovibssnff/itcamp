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
