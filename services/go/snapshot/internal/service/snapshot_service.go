package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/itcamp/ktc/services/snapshot/internal/domain"
	"github.com/itcamp/ktc/services/snapshot/internal/storage"
)

// SnapshotRepo — интерфейс хранилища метаданных снапшотов.
type SnapshotRepo interface {
	GetByID(ctx context.Context, id string) (domain.SnapshotMeta, error)
	Create(ctx context.Context, m domain.SnapshotMeta) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, sessionID string, isPreset *bool, limit, offset int) ([]domain.SnapshotMeta, error)
}

// SnapshotStorage — интерфейс объектного хранилища (S3).
type SnapshotStorage interface {
	Save(ctx context.Context, key string, data []byte) (string, error)
	Load(ctx context.Context, key string) ([]byte, error)
	Delete(ctx context.Context, key string) error
}

type SnapshotService struct {
	repo    SnapshotRepo
	storage SnapshotStorage
	log     *slog.Logger
}

func NewSnapshotService(repo SnapshotRepo, storage SnapshotStorage, log *slog.Logger) *SnapshotService {
	return &SnapshotService{repo: repo, storage: storage, log: log}
}

func (s *SnapshotService) Save(ctx context.Context, req domain.SaveRequest, authorID string) (domain.SaveResponse, error) {
	if len(req.PayloadJSON) == 0 {
		return domain.SaveResponse{}, fmt.Errorf("payload is empty")
	}

	snapshotID := newUUID()
	storageKey := fmt.Sprintf("snapshots/%s/%s.json.gz", req.SessionID, snapshotID)

	sha, err := s.storage.Save(ctx, storageKey, req.PayloadJSON)
	if err != nil {
		s.log.Error("s3 save failed", "error", err)
		return domain.SaveResponse{}, domain.ErrStorageFailed
	}

	meta := domain.SnapshotMeta{
		ID:            snapshotID,
		SessionID:     req.SessionID,
		Name:          req.Name,
		ModelTime:     req.ModelTime,
		AuthorID:      authorID,
		SchemaVersion: req.SchemaVersion,
		SHA256:        sha,
		StorageKey:    storageKey,
		IsPreset:      req.IsPreset,
	}

	if err := s.repo.Create(ctx, meta); err != nil {
		_ = s.storage.Delete(ctx, storageKey)
		return domain.SaveResponse{}, err
	}
	IncSnapshotSaved(req.IsPreset)

	s.log.Info("snapshot saved", "id", snapshotID, "session", req.SessionID, "sha256", sha[:12]+"...")
	return domain.SaveResponse{SnapshotID: snapshotID, SHA256: sha, StorageKey: storageKey}, nil
}

func (s *SnapshotService) Restore(ctx context.Context, snapshotID string) (domain.RestoreResponse, error) {
	meta, err := s.repo.GetByID(ctx, snapshotID)
	if err != nil {
		return domain.RestoreResponse{}, err
	}

	data, err := s.storage.Load(ctx, meta.StorageKey)
	if err != nil {
		s.log.Error("s3 load failed", "error", err)
		return domain.RestoreResponse{}, domain.ErrStorageFailed
	}

	shaValid := storage.ValidateSHA256(data, meta.SHA256)
	if !shaValid {
		IncSnapshotRestoreInvalid()
		s.log.Error("sha256 mismatch", "snapshot", snapshotID, "expected", meta.SHA256)
	}
	IncSnapshotRestored()

	return domain.RestoreResponse{
		PayloadJSON:   data,
		ModelTime:     meta.ModelTime,
		SHA256Valid:   shaValid,
		SchemaVersion: meta.SchemaVersion,
	}, nil
}

func (s *SnapshotService) GetMeta(ctx context.Context, id string) (domain.SnapshotMeta, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *SnapshotService) List(ctx context.Context, sessionID string, isPreset *bool, limit, offset int) ([]domain.SnapshotMeta, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	return s.repo.List(ctx, sessionID, isPreset, limit, offset)
}

func (s *SnapshotService) Delete(ctx context.Context, id string) error {
	meta, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if meta.IsPreset {
		return domain.ErrPresetDeleteForbidden
	}
	if err := s.storage.Delete(ctx, meta.StorageKey); err != nil {
		s.log.Warn("s3 delete failed", "error", err)
	}
	IncSnapshotDeleted()
	return s.repo.Delete(ctx, id)
}
