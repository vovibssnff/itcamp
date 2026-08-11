package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/itcamp/ktc/services/report/internal/domain"
	"github.com/itcamp/ktc/services/report/internal/service"
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
	case errors.Is(err, domain.ErrBadRequest):
		return http.StatusBadRequest, "bad_request"
	case errors.Is(err, domain.ErrReportNotFound):
		return http.StatusNotFound, "not_found"
	case errors.Is(err, domain.ErrReportNotReady):
		return http.StatusConflict, "not_ready"
	default:
		return http.StatusInternalServerError, "internal"
	}
}

type ReportHandler struct {
	svc *service.ReportService
}

func NewReportHandler(svc *service.ReportService) *ReportHandler {
	return &ReportHandler{svc: svc}
}

func (h *ReportHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, errors.Join(err, domain.ErrBadRequest))
		return
	}
	if req.SessionID == "" {
		writeError(w, domain.ErrBadRequest)
		return
	}
	if req.Type == "" {
		req.Type = domain.ReportSession
	}
	rep, err := h.svc.Create(r.Context(), req.SessionID, req.Type)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, rep)
}

func (h *ReportHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	rep, err := h.svc.Get(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toReportResponse(rep))
}

func (h *ReportHandler) List(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	reports, err := h.svc.ListBySession(r.Context(), sessionID)
	if err != nil {
		writeError(w, err)
		return
	}
	resp := make([]ReportResponse, 0, len(reports))
	for _, rep := range reports {
		resp = append(resp, toReportResponse(rep))
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *ReportHandler) Download(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	rep, err := h.svc.Get(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	if rep.Status != domain.StatusReady {
		writeError(w, domain.ErrReportNotReady)
		return
	}
	if rep.DownloadURL != "" {
		w.Header().Set("Location", rep.DownloadURL)
		w.WriteHeader(http.StatusFound)
		return
	}
	w.WriteHeader(http.StatusNotFound)
}

func (h *ReportHandler) File(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	pdfBytes, err := h.svc.Download(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"report-%s.pdf\"", id))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pdfBytes)
}

type ReportResponse struct {
	ID          string `json:"id"`
	SessionID   string `json:"session_id"`
	Type        string `json:"type"`
	Status      string `json:"status"`
	DownloadURL string `json:"download_url,omitempty"`
	Error       string `json:"error,omitempty"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

func toReportResponse(r domain.Report) ReportResponse {
	return ReportResponse{
		ID:          r.ID,
		SessionID:   r.SessionID,
		Type:        string(r.Type),
		Status:      string(r.Status),
		DownloadURL: r.DownloadURL,
		Error:       r.Error,
		CreatedAt:   r.CreatedAt,
		UpdatedAt:   r.UpdatedAt,
	}
}
