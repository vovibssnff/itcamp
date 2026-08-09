package domain

import "errors"

type SnapshotMeta struct {
	ID            string  `json:"id"`
	SessionID     string  `json:"session_id"`
	Name          string  `json:"name"`
	ModelTime     float64 `json:"model_time"`
	AuthorID      string  `json:"author_id"`
	SchemaVersion string  `json:"schema_version"`
	SHA256        string  `json:"sha256"`
	StorageKey    string  `json:"storage_key"`
	IsPreset      bool    `json:"is_preset"`
	CreatedAt     string  `json:"created_at"`
}

type SaveRequest struct {
	SessionID     string  `json:"session_id"`
	Name          string  `json:"name"`
	IsPreset      bool    `json:"is_preset"`
	SchemaVersion string  `json:"schema_version"`
	ModelTime     float64 `json:"model_time"`
	Seed          int64   `json:"seed"`
	PayloadJSON   []byte  `json:"payload_json"`
}

type SaveResponse struct {
	SnapshotID string `json:"snapshot_id"`
	SHA256     string `json:"sha256"`
	StorageKey string `json:"storage_key"`
}

type RestoreRequest struct {
	SnapshotID string `json:"snapshot_id"`
}

type RestoreResponse struct {
	PayloadJSON   []byte  `json:"payload_json"`
	ModelTime     float64 `json:"model_time"`
	Seed          int64   `json:"seed"`
	SHA256Valid   bool    `json:"sha256_valid"`
	SchemaVersion string  `json:"schema_version"`
}

var (
	ErrSnapshotNotFound  = errors.New("snapshot not found")
	ErrSHA256Mismatch    = errors.New("sha256 mismatch")
	ErrPresetDeleteForbidden = errors.New("cannot delete preset")
	ErrStorageFailed     = errors.New("storage operation failed")
)
