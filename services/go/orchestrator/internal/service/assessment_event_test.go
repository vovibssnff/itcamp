package service

import "testing"

func TestMapSimCommandToAssessment_SetMode(t *testing.T) {
	action, val := mapSimCommandToAssessment("SET_MODE", 1.0)
	if action != "set_mode" {
		t.Fatalf("action = %q, want set_mode", action)
	}
	if val != "MANUAL" {
		t.Fatalf("value = %#v, want MANUAL", val)
	}
	action, val = mapSimCommandToAssessment("SET_MODE", 0.0)
	if action != "set_mode" || val != "AUTO" {
		t.Fatalf("got %s/%#v, want set_mode/AUTO", action, val)
	}
}

func TestMapSimCommandToAssessment_ESD(t *testing.T) {
	action, _ := mapSimCommandToAssessment("ESD", nil)
	if action != "confirm" {
		t.Fatalf("action = %q, want confirm", action)
	}
}

func TestMapSimCommandToAssessment_StartStop(t *testing.T) {
	action, _ := mapSimCommandToAssessment("START", nil)
	if action != "start" {
		t.Fatalf("action = %q, want start", action)
	}
	action, _ = mapSimCommandToAssessment("STOP", nil)
	if action != "stop" {
		t.Fatalf("action = %q, want stop", action)
	}
}

func TestAssessmentActionPayload(t *testing.T) {
	p := assessmentActionPayload("u1", "LRCA-641", "SET_MODE", 1.0, 12.5)
	if p["action"] != "set_mode" {
		t.Fatalf("action = %#v", p["action"])
	}
	if p["value"] != "MANUAL" {
		t.Fatalf("value = %#v", p["value"])
	}
	if p["target"] != "LRCA-641" {
		t.Fatalf("target = %#v", p["target"])
	}
	if p["model_time"] != 12.5 {
		t.Fatalf("model_time = %#v", p["model_time"])
	}
}
