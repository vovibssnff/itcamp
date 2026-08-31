package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

// HTTPSimClient talks to sim-worker REST Model API (compose: http://sim-worker:8081).
type HTTPSimClient struct {
	base   string
	client *http.Client
}

func NewHTTPSimClient(baseURL string) *HTTPSimClient {
	return &HTTPSimClient{
		base:   trimTrailingSlash(baseURL),
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

func trimTrailingSlash(s string) string {
	for len(s) > 0 && s[len(s)-1] == '/' {
		s = s[:len(s)-1]
	}
	return s
}

func (c *HTTPSimClient) CreateSession(ctx context.Context, sessionID string, initState []byte, seed int64) error {
	if seed == 0 && len(initState) > 0 {
		var meta struct {
			Seed int64 `json:"seed"`
		}
		_ = json.Unmarshal(initState, &meta)
		if meta.Seed != 0 {
			seed = meta.Seed
		}
	}
	payload, _ := json.Marshal(map[string]any{
		"session_id": sessionID,
		"seed":       seed,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/v1/sessions", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("sim create session: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusConflict {
		// Idempotent: session already exists on shared worker.
		return nil
	}
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("sim create session: status %d: %s", resp.StatusCode, string(body))
	}
	// Best-effort: apply tag overrides from constructor export if present.
	c.applyInitTags(ctx, sessionID, initState)
	return nil
}

func (c *HTTPSimClient) applyInitTags(ctx context.Context, sessionID string, initState []byte) {
	if len(initState) == 0 {
		return
	}
	var export struct {
		Tags []struct {
			TagID string  `json:"tag_id"`
			Value float64 `json:"value"`
		} `json:"tags"`
	}
	if err := json.Unmarshal(initState, &export); err != nil || len(export.Tags) == 0 {
		return
	}
	overrides := make(map[string]float64, len(export.Tags))
	for _, t := range export.Tags {
		if t.TagID != "" {
			overrides[t.TagID] = t.Value
		}
	}
	if len(overrides) == 0 {
		return
	}
	payload, _ := json.Marshal(map[string]any{"tag_overrides": overrides})
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, c.base+"/v1/sessions/"+sessionID+"/state", bytes.NewReader(payload))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return
	}
	_ = resp.Body.Close()
}

func (c *HTTPSimClient) DestroySession(ctx context.Context, sessionID string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, c.base+"/v1/sessions/"+sessionID, nil)
	if err != nil {
		return err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("sim destroy session: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 && resp.StatusCode != http.StatusNotFound {
		return fmt.Errorf("sim destroy session: status %d", resp.StatusCode)
	}
	return nil
}

func (c *HTTPSimClient) Step(ctx context.Context, sessionID string, dtSec float64) (domain.SimState, error) {
	if dtSec <= 0 {
		dtSec = 1
	}
	payload, _ := json.Marshal(map[string]any{"real_dt_s": dtSec})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/v1/sessions/"+sessionID+"/step", bytes.NewReader(payload))
	if err != nil {
		return domain.SimState{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return domain.SimState{}, fmt.Errorf("sim step: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return domain.SimState{}, fmt.Errorf("%w: step status %d", domain.ErrSimUnavailable, resp.StatusCode)
	}
	var result struct {
		State         workerState   `json:"state"`
		NewAlarms     []workerAlarm `json:"new_alarms"`
		ClearedAlarms []workerAlarm `json:"cleared_alarms"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return domain.SimState{}, fmt.Errorf("sim step decode: %w", err)
	}
	st := result.State.toDomain(sessionID)
	st.NewAlarms = workerAlarmsToDomain(sessionID, result.NewAlarms)
	st.ClearedAlarms = workerAlarmsToDomain(sessionID, result.ClearedAlarms)
	return st, nil
}

func (c *HTTPSimClient) GetState(ctx context.Context, sessionID string) (domain.SimState, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base+"/v1/sessions/"+sessionID+"/state", nil)
	if err != nil {
		return domain.SimState{}, err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return domain.SimState{}, fmt.Errorf("sim get state: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return domain.SimState{}, fmt.Errorf("%w: get state status %d", domain.ErrSimUnavailable, resp.StatusCode)
	}
	var st workerState
	if err := json.NewDecoder(resp.Body).Decode(&st); err != nil {
		return domain.SimState{}, fmt.Errorf("sim get state decode: %w", err)
	}
	return st.toDomain(sessionID), nil
}

func (c *HTTPSimClient) SetState(ctx context.Context, sessionID string, state domain.SimState) error {
	overrides := make(map[string]float64, len(state.Tags))
	for _, t := range state.Tags {
		overrides[t.TagID] = t.Value
	}
	payload, _ := json.Marshal(map[string]any{
		"tag_overrides": overrides,
		"model_time_s":  state.ModelTime,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, c.base+"/v1/sessions/"+sessionID+"/state", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("sim set state: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("sim set state: status %d", resp.StatusCode)
	}
	return nil
}

func (c *HTTPSimClient) InjectFault(ctx context.Context, fault domain.InjectFaultReq) error {
	mag := fault.SeverityPct / 100.0
	if mag <= 0 {
		mag = 1.0
	}
	body := map[string]any{
		"fault_id":  fault.FaultID,
		"magnitude": mag,
	}
	// Scenario ramp_seconds overrides catalog ramp when set (>0).
	if fault.RampSeconds > 0 {
		body["ramp_s"] = fault.RampSeconds
	}
	payload, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/v1/sessions/"+fault.SessionID+"/faults", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("sim inject fault: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("sim inject fault: status %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

func (c *HTTPSimClient) SetSpeed(ctx context.Context, sessionID string, factor float64) error {
	payload, _ := json.Marshal(map[string]any{"multiplier": factor})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/v1/sessions/"+sessionID+"/speed", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("sim set speed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("sim set speed: status %d", resp.StatusCode)
	}
	return nil
}

func (c *HTTPSimClient) SetActuator(ctx context.Context, sessionID, tag string, value any) error {
	tag = CanonicalActuatorTag(tag)
	cmd, v := ResolveActuatorCommand(tag, value)
	return c.Command(ctx, sessionID, cmd, tag, v)
}

func (c *HTTPSimClient) Command(ctx context.Context, sessionID, cmdType, target string, value any) error {
	target = CanonicalActuatorTag(target)
	body := map[string]any{
		"type":   cmdType,
		"target": target,
	}
	if value != nil {
		switch v := value.(type) {
		case float64, float32, int, int64, json.Number:
			body["value_to"] = v
		case string:
			if cmdType == "SET_MODE" {
				// sim: value_to >= 0.5 → MANUAL, else AUTO
				if v == "manual" || v == "MANUAL" {
					body["value_to"] = 1.0
				} else {
					body["value_to"] = 0.0
				}
			} else if f, err := strconv.ParseFloat(v, 64); err == nil {
				body["value_to"] = f
			}
		case bool:
			if v {
				body["value_to"] = 1.0
			} else {
				body["value_to"] = 0.0
			}
		default:
			body["value_to"] = value
		}
	}
	payload, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/v1/sessions/"+sessionID+"/command", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("sim command: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		detail := strings.TrimSpace(string(b))
		if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusBadRequest {
			return fmt.Errorf("%w: %s", domain.ErrInvalidCommand, detail)
		}
		return fmt.Errorf("sim command: status %d: %s", resp.StatusCode, detail)
	}
	return nil
}

type workerAlarm struct {
	AlarmID   string   `json:"alarm_id"`
	TagID     string   `json:"tag_id"`
	Priority  string   `json:"priority"`
	RaisedAtS float64  `json:"raised_at_s"`
	AckAtS    *float64 `json:"ack_at_s"`
}

type workerState struct {
	SessionID       string             `json:"session_id"`
	ModelTimeS      float64            `json:"model_time_s"`
	TagValues       map[string]float64 `json:"tag_values"`
	EquipmentStates map[string]string  `json:"equipment_states"`
	ControllerModes map[string]string  `json:"controller_modes"`
	// ControllerSetpoints / ControllerOutputs are SP and OUT per loop tag.
	// Older sim-workers may omit them; toDomain falls back carefully.
	ControllerSetpoints map[string]float64 `json:"controller_setpoints"`
	ControllerOutputs   map[string]float64 `json:"controller_outputs"`
	// ActiveAlarms accepts both REST list and snapshot map forms.
	ActiveAlarms json.RawMessage `json:"active_alarms"`
}

func parseWorkerAlarms(raw json.RawMessage) []workerAlarm {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var asList []workerAlarm
	if err := json.Unmarshal(raw, &asList); err == nil {
		return asList
	}
	var asMap map[string]workerAlarm
	if err := json.Unmarshal(raw, &asMap); err == nil {
		out := make([]workerAlarm, 0, len(asMap))
		for k, a := range asMap {
			if a.AlarmID == "" {
				a.AlarmID = k
			}
			out = append(out, a)
		}
		return out
	}
	return nil
}

func workerAlarmsToDomain(sessionID string, in []workerAlarm) []domain.AlarmEvent {
	alarms := make([]domain.AlarmEvent, 0, len(in))
	for _, a := range in {
		id := a.AlarmID
		if id == "" {
			id = sessionID + ":" + a.TagID + ":" + a.Priority
		}
		alarms = append(alarms, domain.AlarmEvent{
			ID:              id,
			SessionID:       sessionID,
			TagID:           a.TagID,
			Priority:        a.Priority,
			RaisedModelTime: a.RaisedAtS,
			AckModelTime:    a.AckAtS,
		})
	}
	return alarms
}

func equipmentStateToValue(state string) float64 {
	switch strings.ToUpper(strings.TrimSpace(state)) {
	case "RUNNING", "OPEN", "ON", "TRUE", "1":
		return 1
	case "STOPPED", "CLOSED", "OFF", "FALSE", "0":
		return 0
	default:
		return 0
	}
}

func isLikelyRegulatorTag(id string) bool {
	u := strings.ToUpper(strings.TrimSpace(id))
	for _, p := range []string{"LRCA", "LRCSA", "TRC", "FRC", "FRCA", "PRC", "PRCA", "FQRC", "FYQR"} {
		if strings.HasPrefix(u, p+" ") || strings.HasPrefix(u, p+"-") || u == p {
			return true
		}
	}
	return false
}

func (s workerState) toDomain(sessionID string) domain.SimState {
	if s.SessionID != "" {
		sessionID = s.SessionID
	}
	tags := make([]domain.Tag, 0, len(s.TagValues)+len(s.EquipmentStates))
	for id, v := range s.TagValues {
		tags = append(tags, domain.Tag{TagID: id, Value: v, Quality: "good"})
	}
	// Expose pump/valve discrete states as numeric tags for HMI widgets.
	for id, st := range s.EquipmentStates {
		tags = append(tags, domain.Tag{TagID: id, Value: equipmentStateToValue(st), Quality: "good"})
	}
	alarms := workerAlarmsToDomain(sessionID, parseWorkerAlarms(s.ActiveAlarms))
	regs := make([]domain.Regulator, 0, len(s.ControllerModes))
	for id, mode := range s.ControllerModes {
		if !isLikelyRegulatorTag(id) {
			continue
		}
		pv := s.TagValues[id]
		modeNorm := strings.ToUpper(strings.TrimSpace(mode))
		if modeNorm != "MANUAL" {
			modeNorm = "AUTO"
		}
		sp := pv
		if s.ControllerSetpoints != nil {
			if v, ok := s.ControllerSetpoints[id]; ok {
				sp = v
			}
		}
		out := 0.0
		if s.ControllerOutputs != nil {
			if v, ok := s.ControllerOutputs[id]; ok {
				out = v
			}
		} else {
			// Legacy workers omitted OUT; avoid fabricating OUT=PV (breaks faceplates).
			out = 0
		}
		regs = append(regs, domain.Regulator{
			TagID: id,
			PV:    pv,
			SP:    sp,
			OUT:   out,
			Mode:  modeNorm,
		})
	}
	return domain.SimState{
		SessionID:  sessionID,
		ModelTime:  s.ModelTimeS,
		Tags:       tags,
		Regulators: regs,
		Alarms:     alarms,
	}
}
