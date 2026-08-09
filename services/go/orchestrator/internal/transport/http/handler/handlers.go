package handler

import (
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
	case errors.Is(err, domain.ErrInvalidSpeed):
		return http.StatusBadRequest, "invalid_speed"
	case errors.Is(err, domain.ErrExamRestoreForbidden):
		return http.StatusForbidden, "exam_restore_forbidden"
	case errors.Is(err, domain.ErrSimUnavailable):
		return http.StatusServiceUnavailable, "sim_unavailable"
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
	sessions, err := h.svc.List(r.Context(), status, operatorID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sessions)
}

func (h *SessionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in service.CreateSessionInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, err)
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
	sess, err := h.svc.Get(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

func (h *SessionHandler) Start(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	sess, err := h.svc.Start(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

func (h *SessionHandler) Pause(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	sess, err := h.svc.Pause(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

func (h *SessionHandler) Stop(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	sess, err := h.svc.Stop(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

func (h *SessionHandler) Speed(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
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
	alarmID := r.PathValue("alarm_id")
	if err := h.svc.AckAlarm(r.Context(), id, alarmID, userIDFromHeader(r)); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *SessionHandler) WSOperator(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	h.handleWS(w, r, id, "operator")
}

func (h *SessionHandler) WSObserve(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	h.handleWS(w, r, id, "observer")
}

func (h *SessionHandler) handleWS(w http.ResponseWriter, r *http.Request, sessionID, role string) {
	userID := userIDFromHeader(r)
	if userID == "" {
		userID = "anonymous"
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true,
	})
	if err != nil {
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	client := service.NewWSClient(role, userID)
	h.hub.Register(sessionID, client)
	defer h.hub.Unregister(sessionID, client)
	defer client.Close()

	ctx := r.Context()

	go func() {
		for {
			_, _, err := conn.Read(ctx)
			if err != nil {
				return
			}
		}
	}()

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
