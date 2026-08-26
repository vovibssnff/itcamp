package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/itcamp/ktc/services/snapshot/internal/domain"
	"github.com/itcamp/ktc/services/snapshot/internal/service"
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
	case errors.Is(err, domain.ErrSnapshotNotFound):
		return http.StatusNotFound, "not_found"
	case errors.Is(err, domain.ErrPresetDeleteForbidden):
		return http.StatusForbidden, "preset_delete_forbidden"
	case errors.Is(err, domain.ErrSHA256Mismatch):
		return http.StatusUnprocessableEntity, "sha256_mismatch"
	case errors.Is(err, domain.ErrStorageFailed):
		return http.StatusServiceUnavailable, "storage_failed"
	case errors.Is(err, domain.ErrSnapshotWrongSession):
		return http.StatusConflict, "snapshot_wrong_session"
	default:
		return http.StatusInternalServerError, "internal"
	}
}

func userIDFromHeader(r *http.Request) string {
	return r.Header.Get("X-User-ID")
}

func queryInt(r *http.Request, key string, def int) int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return def
	}
	var n int
	_, _ = fmt.Sscanf(v, "%d", &n)
	if n <= 0 {
		return def
	}
	return n
}

func queryBool(r *http.Request, key string) *bool {
	v := r.URL.Query().Get(key)
	if v == "" {
		return nil
	}
	b := v == "true" || v == "1"
	return &b
}

type SnapshotHandler struct {
	svc *service.SnapshotService
}

func NewSnapshotHandler(svc *service.SnapshotService) *SnapshotHandler {
	return &SnapshotHandler{svc: svc}
}

func (h *SnapshotHandler) List(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	isPreset := queryBool(r, "is_preset")
	limit := queryInt(r, "limit", 50)
	offset := queryInt(r, "offset", 0)
	snapshots, err := h.svc.List(r.Context(), sessionID, isPreset, limit, offset)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshots)
}

func (h *SnapshotHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	meta, err := h.svc.GetMeta(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, meta)
}

func (h *SnapshotHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Delete(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *SnapshotHandler) Save(w http.ResponseWriter, r *http.Request) {
	var req domain.SaveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err)
		return
	}
	resp, err := h.svc.Save(r.Context(), req, userIDFromHeader(r))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *SnapshotHandler) Restore(w http.ResponseWriter, r *http.Request) {
	var req domain.RestoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, err)
		return
	}
	resp, err := h.svc.Restore(r.Context(), req.SnapshotID, req.SessionID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}
