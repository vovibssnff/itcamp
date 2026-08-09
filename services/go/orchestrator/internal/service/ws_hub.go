package service

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
)

func newUUID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return hex.EncodeToString(b)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	h := hex.EncodeToString(b)
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:32]
}

type WSHub struct {
	mu      sync.RWMutex
	clients map[string]map[*WSClient]bool
}

func NewWSHub() *WSHub {
	return &WSHub{clients: make(map[string]map[*WSClient]bool)}
}

func (h *WSHub) Register(sessionID string, c *WSClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[sessionID] == nil {
		h.clients[sessionID] = make(map[*WSClient]bool)
	}
	h.clients[sessionID][c] = true
}

func (h *WSHub) Unregister(sessionID string, c *WSClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.clients[sessionID]; ok {
		delete(clients, c)
		if len(clients) == 0 {
			delete(h.clients, sessionID)
		}
	}
}

func (h *WSHub) BroadcastTelemetry(sessionID string, telemetry any) {
	h.mu.RLock()
	clients := h.clients[sessionID]
	h.mu.RUnlock()
	msg := map[string]any{"type": "telemetry", "data": telemetry}
	for c := range clients {
		c.Send(msg)
	}
}

func (h *WSHub) BroadcastOperatorAction(sessionID string, action any) {
	h.mu.RLock()
	clients := h.clients[sessionID]
	h.mu.RUnlock()
	msg := map[string]any{"type": "operator_action", "data": action}
	for c := range clients {
		c.Send(msg)
	}
}

func (h *WSHub) BroadcastAlarm(sessionID string, alarm any) {
	h.mu.RLock()
	clients := h.clients[sessionID]
	h.mu.RUnlock()
	msg := map[string]any{"type": "alarm", "data": alarm}
	for c := range clients {
		c.Send(msg)
	}
}

func (h *WSHub) BroadcastSessionStatus(sessionID string, status string, modelTime float64) {
	h.mu.RLock()
	clients := h.clients[sessionID]
	h.mu.RUnlock()
	msg := map[string]any{"type": "session_status", "status": status, "model_time": modelTime}
	for c := range clients {
		c.Send(msg)
	}
}

func (h *WSHub) ClientCount(sessionID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients[sessionID])
}
