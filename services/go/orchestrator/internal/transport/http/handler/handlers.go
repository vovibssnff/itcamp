package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"nhooyr.io/websocket"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
	"github.com/itcamp/ktc/services/orchestrator/internal/service"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func mustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte(`{}`)
	}
	return b
}

func writeError(w http.ResponseWriter, err error) {
	status, code := mapError(err)
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"type": "about:blank", "title": code, "status": status, "detail": err.Error()})
}

func mapError(err error) (int, string) {
	switch {
	case errors.Is(err, domain.ErrSessionNotFound):
		return http.StatusNotFound, "session_not_found"
	case errors.Is(err, domain.ErrSessionAlreadyRunning):
		return http.StatusConflict, "already_running"
	case errors.Is(err, domain.ErrSessionNotRunning):
		return http.StatusConflict, "not_running"
	case errors.Is(err, domain.ErrSessionNotPaused):
		return http.StatusConflict, "not_paused"
	case errors.Is(err, domain.ErrInvalidSpeed):
		return http.StatusBadRequest, "invalid_speed"
	case errors.Is(err, domain.ErrExamRestoreForbidden):
		return http.StatusForbidden, "exam_restore_forbidden"
	case errors.Is(err, domain.ErrForbidden):
		return http.StatusForbidden, "forbidden"
	case errors.Is(err, domain.ErrSimUnavailable):
		return http.StatusServiceUnavailable, "sim_unavailable"
	case errors.Is(err, domain.ErrInvalidCommand):
		return http.StatusBadRequest, "invalid_command"
	default:
		return http.StatusInternalServerError, "internal"
	}
}

func userIDFromHeader(r *http.Request) string {
	return r.Header.Get("X-User-ID")
}

type SessionHandler struct {
	svc *service.SessionService
	hub *service.WSHub
}

func NewSessionHandler(svc *service.SessionService, hub *service.WSHub) *SessionHandler {
	return &SessionHandler{svc: svc, hub: hub}
}

func (h *SessionHandler) List(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	operatorID := r.URL.Query().Get("operator_id")
	roles := rolesFromHeader(r)
	uid := userIDFromHeader(r)
	// Operators may only list their own sessions.
	if !isPrivileged(roles) {
		if uid == "" {
			writeError(w, domain.ErrForbidden)
			return
		}
		operatorID = uid
	}
	sessions, err := h.svc.List(r.Context(), status, operatorID)
	if err != nil {
		writeError(w, err)
		return
	}
	if sessions == nil {
		sessions = []domain.Session{}
	}
	writeJSON(w, http.StatusOK, sessions)
}

func (h *SessionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in service.CreateSessionInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, err)
		return
	}
	if !canCreateSession(r, in.Mode, in.OperatorIDs) {
		writeError(w, domain.ErrForbidden)
		return
	}
	sess, err := h.svc.Create(r.Context(), userIDFromHeader(r), in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, sess)
}

func (h *SessionHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	sess, ok := loadSessionOrDeny(h, w, r, id)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

func (h *SessionHandler) Start(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := loadSessionOrDeny(h, w, r, id); !ok {
		return
	}
	sess, err := h.svc.Start(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

func (h *SessionHandler) Pause(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := loadSessionOrDeny(h, w, r, id); !ok {
		return
	}
	sess, err := h.svc.Pause(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

func (h *SessionHandler) Resume(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := loadSessionOrDeny(h, w, r, id); !ok {
		return
	}
	sess, err := h.svc.Resume(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

func (h *SessionHandler) Stop(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := loadSessionOrDeny(h, w, r, id); !ok {
		return
	}
	sess, err := h.svc.Stop(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

func (h *SessionHandler) Speed(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := loadSessionOrDeny(h, w, r, id); !ok {
		return
	}
	var req struct {
		Factor float64 `json:"factor"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err)
		return
	}
	sess, err := h.svc.SetSpeed(r.Context(), id, req.Factor)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

func (h *SessionHandler) Checkpoint(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := loadSessionOrDeny(h, w, r, id); !ok {
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	snapID, err := h.svc.Checkpoint(r.Context(), id, req.Name)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"snapshot_id": snapID})
}

func (h *SessionHandler) Restore(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := loadSessionOrDeny(h, w, r, id); !ok {
		return
	}
	var req struct {
		SnapshotID string `json:"snapshot_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err)
		return
	}
	sess, err := h.svc.Restore(r.Context(), id, req.SnapshotID, userIDFromHeader(r))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

func (h *SessionHandler) Actuator(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := loadSessionOrDeny(h, w, r, id); !ok {
		return
	}
	var req struct {
		Tag   string `json:"tag"`
		Value any    `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err)
		return
	}
	if err := h.svc.HandleActuator(r.Context(), id, userIDFromHeader(r), req.Tag, req.Value); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func (h *SessionHandler) AckAlarm(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := loadSessionOrDeny(h, w, r, id); !ok {
		return
	}
	alarmID := r.PathValue("alarm_id")
	if err := h.svc.AckAlarm(r.Context(), id, alarmID, userIDFromHeader(r)); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *SessionHandler) WSOperator(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := loadSessionOrDeny(h, w, r, id); !ok {
		return
	}
	h.handleWS(w, r, id, "operator")
}

func (h *SessionHandler) WSObserve(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := loadSessionOrDeny(h, w, r, id); !ok {
		return
	}
	h.handleWS(w, r, id, "observer")
}

func (h *SessionHandler) handleWS(w http.ResponseWriter, r *http.Request, sessionID, role string) {
	userID := userIDFromHeader(r)
	if userID == "" {
		writeError(w, domain.ErrForbidden)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		// Behind the gateway the request Host is the upstream service name while the
		// browser Origin stays on the SPA host:port — allow any origin here; CSRF is
		// mitigated by the gateway's token auth on the upgrade request.
		OriginPatterns: []string{"*"},
	})
	if err != nil {
		return
	}
	defer func() { _ = conn.Close(websocket.StatusNormalClosure, "") }()

	client := service.NewWSClient(role, userID)
	h.hub.Register(sessionID, client)
	defer h.hub.Unregister(sessionID, client)
	defer client.Close()

	ctx := r.Context()

	go func() {
		for {
			_, data, err := conn.Read(ctx)
			if err != nil {
				return
			}
			if err := h.dispatchWSMessage(ctx, sessionID, userID, role, data); err != nil {
				if errors.Is(err, domain.ErrForbidden) {
					_ = conn.Close(websocket.StatusCode(4403), "observe is read-only")
					return
				}
			}
		}
	}()

	// Сразу отдаём клиенту последний снимок телеметрии из Radix,
	// в том же shape, что и тики: {type:"telemetry", tags:[...]}.
	if t, err := h.svc.LatestTelemetry(ctx, sessionID); err == nil {
		_ = conn.Write(ctx, websocket.MessageText, mustJSON(map[string]any{
			"type": "telemetry",
			"tags": service.TelemetryTagsForWS(t),
		}))
		for _, reg := range service.RegulatorsForWS(t.Regulators) {
			_ = conn.Write(ctx, websocket.MessageText, mustJSON(map[string]any{
				"type":      "regulator_state",
				"regulator": reg,
			}))
		}
	}

	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-client.SendChan():
			if !ok {
				return
			}
			err := conn.Write(ctx, websocket.MessageText, msg)
			if err != nil {
				return
			}
		}
	}
}

// wsClientMessage is the JSON envelope for operator → orchestrator WS frames.
type wsClientMessage struct {
	Type  string  `json:"type"`
	Tag   string  `json:"tag"`
	Value any     `json:"value"`
	ID    string  `json:"id"`
	SP    float64 `json:"sp"`
	Out   float64 `json:"out"`
	Mode  string  `json:"mode"`
}

// wsRoute is the resolved operator command from an inbound WS frame.
type wsRoute struct {
	Ignore  bool
	Kind    string // actuator | ack_alarm | command
	CmdType string // SET_SP | SET_OUT | SET_MODE | ESD (when Kind=command)
	Tag     string
	Value   any
	AlarmID string
}

func parseWSClientMessage(role string, data []byte) (wsRoute, error) {
	var msg wsClientMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return wsRoute{}, err
	}
	if msg.Type == "" || msg.Type == "ping" || msg.Type == "subscribe" {
		return wsRoute{Ignore: true}, nil
	}
	if role == "observer" {
		return wsRoute{}, domain.ErrForbidden
	}
	switch msg.Type {
	case "actuator":
		return wsRoute{Kind: "actuator", Tag: msg.Tag, Value: msg.Value}, nil
	case "ack_alarm":
		return wsRoute{Kind: "ack_alarm", AlarmID: msg.ID}, nil
	case "regulator_sp":
		return wsRoute{Kind: "command", CmdType: "SET_SP", Tag: msg.Tag, Value: msg.SP}, nil
	case "regulator_out":
		return wsRoute{Kind: "command", CmdType: "SET_OUT", Tag: msg.Tag, Value: msg.Out}, nil
	case "regulator_mode":
		modeVal := 0.0
		if msg.Mode == "manual" {
			modeVal = 1.0
		}
		return wsRoute{Kind: "command", CmdType: "SET_MODE", Tag: msg.Tag, Value: modeVal}, nil
	case "esd":
		return wsRoute{Kind: "command", CmdType: "ESD", Tag: msg.Tag, Value: msg.Value}, nil
	default:
		return wsRoute{Ignore: true}, nil
	}
}

func (h *SessionHandler) dispatchWSMessage(ctx context.Context, sessionID, userID, role string, data []byte) error {
	route, err := parseWSClientMessage(role, data)
	if err != nil {
		return err
	}
	if route.Ignore {
		return nil
	}
	switch route.Kind {
	case "actuator":
		return h.svc.HandleActuator(ctx, sessionID, userID, route.Tag, route.Value)
	case "ack_alarm":
		return h.svc.AckAlarm(ctx, sessionID, route.AlarmID, userID)
	case "command":
		return h.svc.HandleOperatorCommand(ctx, sessionID, userID, route.CmdType, route.Tag, route.Value)
	default:
		return nil
	}
}
