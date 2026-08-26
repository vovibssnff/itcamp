package client

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

// ЭЛОУ-style tags matching sim-engine template_atm_demo.json / faults_catalog.json.
var elouBaseTags = []struct {
	id, unit string
	base     float64
	drift    float64
}{
	{"PRSA 204", "kgf/cm2", 2.5, 0.002},
	{"LRCA 602", "%", 55, -0.01},
	{"PRSA 213", "kgf/cm2", 0.4, 0.001},
	{"LRCA 606", "%", 45, -0.005},
	{"PRCA 220", "kgf/cm2", 8.0, 0.003},
	{"PRA 312", "kgf/cm2", 3.5, 0.002},
	{"PRA 351", "kgf/cm2", 12.0, 0.001},
	{"LRCA 641", "mm", 4200, -0.5},
	{"LRCA 640", "mm", 4200, -0.4},
	{"LRCA 639", "mm", 4200, -0.3},
	{"FRC 404", "m3/h", 120, 0.02},
	{"FRC 405", "m3/h", 110, 0.02},
	{"FRC 406", "m3/h", 100, 0.02},
	{"FYQR 117", "m3/h", 1100, 0.05},
	{"TR 55-9", "C", 320, 0.05},
	{"TRC 3", "C", 330, 0.02},
	{"TRC 5", "%", 40, 0.01},
	{"FRC 408", "m3/h", 45, 0.01},
	{"PRA 700", "kgf/cm2", 5.5, -0.001},
	{"PUMP-N1", "", 1, 0},
	{"PUMP-N20", "", 1, 0},
	{"PUMP-N2", "", 1, 0},
	{"PUMP-N6", "", 1, 0},
	{"PUMP-N7", "", 1, 0},
	{"PUMP-N14", "", 1, 0},
}

// Known sim fault → primary tag disturbance (ADD), for MockSim without physics.
var mockFaultEffects = map[string]struct {
	tag   string
	delta float64
}{
	"FLT-ELOU-INTERFACE-LOW": {"LRCA 641", -900},
	"FLT-ELOU-PRESSURE-HIGH": {"PRA 312", 2.5},
	"FLT-FEED-FLOW-LOW":      {"FYQR 117", -400},
	"FLT-P3-COT-HIGH":        {"TR 55-9", 25},
	"FLT-K1-PRESSURE-HIGH":   {"PRSA 204", 2.5},
	"FLT-K1-LEVEL-LOW":       {"LRCA 602", -35},
	"FLT-K2-VACUUM-LOSS":     {"PRSA 213", 1.2},
	"FLT-K31-LEVEL-LOW":      {"LRCA 606", -30},
	"FLT-K4-PRESSURE-HIGH":   {"PRCA 220", 5.0},
	"FLT-IA-PRESSURE-LOW":    {"PRA 700", -4.0},
}

type MockSimClient struct {
	Sessions  map[string]bool
	States    map[string]domain.SimState
	Speeds    map[string]float64
	Faults    []domain.InjectFaultReq
	Actuators []string // "session:tag=value" for tests
	Commands  []string // "session:TYPE:target=value" for tests
	overrides map[string]map[string]float64
	faultBias map[string]map[string]float64
	ackAlarms map[string]map[string]bool
}

func NewMockSimClient() *MockSimClient {
	return &MockSimClient{
		Sessions:  make(map[string]bool),
		States:    make(map[string]domain.SimState),
		Speeds:    make(map[string]float64),
		overrides: make(map[string]map[string]float64),
		faultBias: make(map[string]map[string]float64),
		ackAlarms: make(map[string]map[string]bool),
	}
}

func (m *MockSimClient) CreateSession(_ context.Context, sessionID string, _ []byte, _ int64) error {
	m.Sessions[sessionID] = true
	m.States[sessionID] = domain.SimState{SessionID: sessionID, ModelTime: 0}
	m.Speeds[sessionID] = 1.0
	m.overrides[sessionID] = make(map[string]float64)
	m.faultBias[sessionID] = make(map[string]float64)
	m.ackAlarms[sessionID] = make(map[string]bool)
	return nil
}

func (m *MockSimClient) DestroySession(_ context.Context, sessionID string) error {
	delete(m.Sessions, sessionID)
	delete(m.States, sessionID)
	delete(m.Speeds, sessionID)
	delete(m.overrides, sessionID)
	delete(m.faultBias, sessionID)
	delete(m.ackAlarms, sessionID)
	return nil
}

func (m *MockSimClient) Step(_ context.Context, sessionID string, dtSec float64) (domain.SimState, error) {
	s, ok := m.States[sessionID]
	if !ok {
		return domain.SimState{}, domain.ErrSimUnavailable
	}
	if dtSec <= 0 {
		dtSec = 1
	}
	speed := m.Speeds[sessionID]
	if speed <= 0 {
		speed = 1
	}
	s.ModelTime += dtSec * speed

	ov := m.overrides[sessionID]
	bias := m.faultBias[sessionID]
	tags := make([]domain.Tag, 0, len(elouBaseTags))
	for _, def := range elouBaseTags {
		v := def.base + def.drift*s.ModelTime
		if b, ok := bias[def.id]; ok {
			v += b
		}
		if o, ok := ov[def.id]; ok {
			v = o
		}
		// Also accept hyphen form overrides.
		if o, ok := ov[strings.ReplaceAll(def.id, " ", "-")]; ok {
			v = o
		}
		tags = append(tags, domain.Tag{TagID: def.id, Value: v, Unit: def.unit, Quality: "good"})
	}
	s.Tags = tags
	s.Regulators = []domain.Regulator{
		{TagID: "LRCA 602", PV: tagValue(tags, "LRCA 602"), SP: overrideOr(ov, "LRCA 602", 55), OUT: 48, Mode: "AUTO"},
		{TagID: "FRC 408", PV: tagValue(tags, "FRC 408"), SP: overrideOr(ov, "FRC 408", 45), OUT: 40, Mode: "AUTO"},
		{TagID: "TRC 3", PV: tagValue(tags, "TRC 3"), SP: overrideOr(ov, "TRC 3", 330), OUT: 35, Mode: "AUTO"},
	}
	s.Alarms = m.buildAlarms(sessionID, s.ModelTime, tags)
	s.NewAlarms = append([]domain.AlarmEvent(nil), s.Alarms...)
	m.States[sessionID] = s
	return s, nil
}

func tagValue(tags []domain.Tag, id string) float64 {
	for _, t := range tags {
		if t.TagID == id {
			return t.Value
		}
	}
	return 0
}

func overrideOr(ov map[string]float64, id string, def float64) float64 {
	if ov == nil {
		return def
	}
	if v, ok := ov[id]; ok {
		return v
	}
	return def
}

func (m *MockSimClient) buildAlarms(sessionID string, modelTime float64, tags []domain.Tag) []domain.AlarmEvent {
	var alarms []domain.AlarmEvent
	acks := m.ackAlarms[sessionID]
	for _, t := range tags {
		priority := ""
		switch t.TagID {
		case "PRSA 204":
			if t.Value >= 4.5 {
				priority = "HH"
			}
		case "LRCA 602":
			if t.Value <= 20 {
				priority = "LL"
			}
		case "PRA 312":
			if t.Value >= 4.0 {
				priority = "H"
			}
		case "TR 55-9":
			if t.Value >= 340 {
				priority = "HH"
			}
		case "PRA 700":
			if t.Value <= 2.0 {
				priority = "LL"
			}
		}
		if priority == "" {
			continue
		}
		id := sessionID + ":" + t.TagID
		a := domain.AlarmEvent{
			ID: id, SessionID: sessionID, TagID: t.TagID,
			Priority: priority, RaisedModelTime: modelTime,
		}
		if acks[t.TagID] {
			mt := modelTime
			a.AckModelTime = &mt
		}
		alarms = append(alarms, a)
	}
	return alarms
}

func (m *MockSimClient) GetState(_ context.Context, sessionID string) (domain.SimState, error) {
	s, ok := m.States[sessionID]
	if !ok {
		return domain.SimState{}, domain.ErrSimUnavailable
	}
	return s, nil
}

func (m *MockSimClient) SetState(_ context.Context, sessionID string, state domain.SimState) error {
	m.States[sessionID] = state
	if m.overrides[sessionID] == nil {
		m.overrides[sessionID] = make(map[string]float64)
	}
	for _, t := range state.Tags {
		m.overrides[sessionID][t.TagID] = t.Value
	}
	return nil
}

func (m *MockSimClient) InjectFault(_ context.Context, req domain.InjectFaultReq) error {
	m.Faults = append(m.Faults, req)
	if m.faultBias[req.SessionID] == nil {
		m.faultBias[req.SessionID] = make(map[string]float64)
	}
	if eff, ok := mockFaultEffects[req.FaultID]; ok {
		mag := req.SeverityPct / 100.0
		if mag <= 0 {
			mag = 1
		}
		m.faultBias[req.SessionID][eff.tag] += eff.delta * mag
	}
	return nil
}

func (m *MockSimClient) SetSpeed(_ context.Context, sessionID string, factor float64) error {
	m.Speeds[sessionID] = factor
	return nil
}

func (m *MockSimClient) SetActuator(ctx context.Context, sessionID, tag string, value any) error {
	tag = CanonicalActuatorTag(tag)
	cmd, v := ResolveActuatorCommand(tag, value)
	return m.Command(ctx, sessionID, cmd, tag, v)
}

func (m *MockSimClient) Command(_ context.Context, sessionID, cmdType, target string, value any) error {
	if !m.Sessions[sessionID] {
		return domain.ErrSimUnavailable
	}
	m.Commands = append(m.Commands, fmt.Sprintf("%s:%s:%s=%v", sessionID, cmdType, target, value))
	tag := normalizeSimTag(target)
	switch cmdType {
	case "SET_SP", "SET_OUT", "OPEN", "CLOSE", "START", "STOP":
		f, ok := toFloat(value)
		if cmdType == "START" {
			f, ok = 1, true
		}
		if cmdType == "STOP" {
			f, ok = 0, true
		}
		if cmdType == "CLOSE" && (value == nil || !ok) {
			f, ok = 0, true
		}
		if cmdType == "OPEN" && (value == nil || !ok) {
			f, ok = 100, true
		}
		if !ok {
			return fmt.Errorf("actuator value must be numeric")
		}
		if m.overrides[sessionID] == nil {
			m.overrides[sessionID] = make(map[string]float64)
		}
		m.overrides[sessionID][tag] = f
		m.Actuators = append(m.Actuators, fmt.Sprintf("%s:%s=%v", sessionID, tag, f))
		// Stopped feed/furnace pumps disturb process so MockSim raises alarms like the real engine.
		if cmdType == "STOP" {
			if m.faultBias[sessionID] == nil {
				m.faultBias[sessionID] = make(map[string]float64)
			}
			switch tag {
			case "PUMP-N1":
				m.faultBias[sessionID]["PRA 312"] = 3
			case "PUMP-N2", "PUMP-N3":
				m.faultBias[sessionID]["PRSA 204"] = 5
			case "PUMP-N6":
				m.faultBias[sessionID]["PRSA 204"] = 5
			}
		}
		if cmdType == "START" {
			switch tag {
			case "PUMP-N1":
				delete(m.faultBias[sessionID], "PRA 312")
			case "PUMP-N2", "PUMP-N3", "PUMP-N6":
				delete(m.faultBias[sessionID], "PRSA 204")
			}
		}
		// Keep state tags in sync for GetState without Step.
		if s, ok := m.States[sessionID]; ok {
			found := false
			for i := range s.Tags {
				if normalizeSimTag(s.Tags[i].TagID) == tag {
					s.Tags[i].Value = f
					found = true
					break
				}
			}
			if !found {
				s.Tags = append(s.Tags, domain.Tag{TagID: tag, Value: f, Quality: "good"})
			}
			m.States[sessionID] = s
		}
	case "SET_MODE":
		// Mode is recorded in Commands; no tag override required.
	case "ACK_ALARM":
		if m.ackAlarms[sessionID] == nil {
			m.ackAlarms[sessionID] = make(map[string]bool)
		}
		m.ackAlarms[sessionID][tag] = true
	case "ESD":
		if m.overrides[sessionID] == nil {
			m.overrides[sessionID] = make(map[string]float64)
		}
		m.overrides[sessionID]["TRC 3"] = 0
		m.overrides[sessionID]["TRC 5"] = 0
	}
	return nil
}

func normalizeSimTag(tag string) string {
	tag = strings.TrimSpace(tag)
	upper := strings.ToUpper(tag)
	// Equipment discrete tags keep hyphen form (PUMP-N1); instrument tags use spaces.
	if strings.HasPrefix(upper, "PUMP-") || strings.HasPrefix(upper, "FAN-") ||
		strings.HasPrefix(upper, "XV-") || strings.HasPrefix(upper, "ZV-") {
		return upper
	}
	return strings.ReplaceAll(tag, "-", " ")
}

func toFloat(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, !math.IsNaN(n)
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	case json.Number:
		f, err := n.Float64()
		return f, err == nil
	case string:
		f, err := strconv.ParseFloat(n, 64)
		return f, err == nil
	default:
		return 0, false
	}
}

type MockAssessmentClient struct {
	Events    []string
	Scores    map[string]any
	Finalized []string
}

func NewMockAssessmentClient() *MockAssessmentClient {
	return &MockAssessmentClient{
		Scores: make(map[string]any),
	}
}

func (m *MockAssessmentClient) SendEvent(_ context.Context, sessionID, _scenarioID, eventType string, _ any) error {
	m.Events = append(m.Events, sessionID+":"+eventType)
	return nil
}

func (m *MockAssessmentClient) GetScore(_ context.Context, sessionID string) (any, error) {
	return m.Scores[sessionID], nil
}

func (m *MockAssessmentClient) Finalize(_ context.Context, sessionID string) error {
	m.Finalized = append(m.Finalized, sessionID)
	return nil
}

func (m *MockAssessmentClient) CheckMissedSteps(_ context.Context, _ string, _ float64) error {
	return nil
}

type MockSnapshotClient struct {
	Snapshots map[string]domain.SimState
	Meta      map[string]struct {
		SessionID string
		IsPreset  bool
	}
	counter int
}

func NewMockSnapshotClient() *MockSnapshotClient {
	return &MockSnapshotClient{
		Snapshots: make(map[string]domain.SimState),
		Meta: make(map[string]struct {
			SessionID string
			IsPreset  bool
		}),
	}
}

func (m *MockSnapshotClient) Save(_ context.Context, sessionID, name string, isPreset bool, state domain.SimState) (string, string, error) {
	m.counter++
	id := "snap-" + sessionID + "-" + name
	m.Snapshots[id] = state
	m.Meta[id] = struct {
		SessionID string
		IsPreset  bool
	}{SessionID: sessionID, IsPreset: isPreset}
	return id, "sha256-mock", nil
}

func (m *MockSnapshotClient) Restore(_ context.Context, snapshotID, sessionID string) (domain.SimState, error) {
	s, ok := m.Snapshots[snapshotID]
	if !ok {
		return domain.SimState{}, domain.ErrSnapshotNotFound
	}
	if meta, ok := m.Meta[snapshotID]; ok {
		if !meta.IsPreset && meta.SessionID != "" && meta.SessionID != sessionID {
			return domain.SimState{}, domain.ErrSnapshotWrongSession
		}
	}
	return s, nil
}
