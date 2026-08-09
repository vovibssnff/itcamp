package service

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"

	"github.com/itcamp/ktc/services/snapshot/internal/domain"
	"github.com/itcamp/ktc/services/snapshot/internal/storage"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

type mockRepo struct {
	meta        domain.SnapshotMeta
	getErr      error
	createErr   error
	deleteErr   error
	metaList    []domain.SnapshotMeta
	listErr     error
	getCalls    int
	createCalls int
	deleteCalls int
	listCalls   int
}

func (m *mockRepo) GetByID(ctx context.Context, id string) (domain.SnapshotMeta, error) {
	m.getCalls++
	return m.meta, m.getErr
}

func (m *mockRepo) Create(ctx context.Context, meta domain.SnapshotMeta) error {
	m.createCalls++
	return m.createErr
}

func (m *mockRepo) Delete(ctx context.Context, id string) error {
	m.deleteCalls++
	return m.deleteErr
}

func (m *mockRepo) List(ctx context.Context, sessionID string, isPreset *bool, limit, offset int) ([]domain.SnapshotMeta, error) {
	m.listCalls++
	return m.metaList, m.listErr
}

type mockStorage struct {
	sha       string
	saveErr   error
	data      []byte
	loadErr   error
	deleteErr error
	delCalls  int
	savedKey  string
	savedData []byte
	loadCalls int
}

func (m *mockStorage) Save(ctx context.Context, key string, data []byte) (string, error) {
	m.savedKey = key
	m.savedData = data
	return m.sha, m.saveErr
}

func (m *mockStorage) Load(ctx context.Context, key string) ([]byte, error) {
	m.loadCalls++
	return m.data, m.loadErr
}

func (m *mockStorage) Delete(ctx context.Context, key string) error {
	m.delCalls++
	return m.deleteErr
}

func TestSnapshotService_Save(t *testing.T) {
	t.Run("EmptyPayload", func(t *testing.T) {
		repo := &mockRepo{}
		st := &mockStorage{}
		svc := NewSnapshotService(repo, st, discardLogger())

		_, err := svc.Save(context.Background(), domain.SaveRequest{}, "author-1")
		if err == nil {
			t.Fatal("expected error for empty payload")
		}
		if st.saveErr == nil {
			if repo.createCalls != 0 {
				t.Fatal("repo.Create must not be called on empty payload")
			}
		}
	})

	t.Run("StorageFailed", func(t *testing.T) {
		repo := &mockRepo{}
		st := &mockStorage{saveErr: errors.New("s3 down")}
		svc := NewSnapshotService(repo, st, discardLogger())

		_, err := svc.Save(context.Background(), domain.SaveRequest{SessionID: "s1", PayloadJSON: []byte("{}")}, "author-1")
		if !errors.Is(err, domain.ErrStorageFailed) {
			t.Fatalf("expected ErrStorageFailed, got %v", err)
		}
		if repo.createCalls != 0 {
			t.Fatal("repo.Create must not be called when storage fails")
		}
	})

	t.Run("RepoCreateFailed", func(t *testing.T) {
		repo := &mockRepo{createErr: errors.New("db down")}
		st := &mockStorage{sha: "abc123"}
		svc := NewSnapshotService(repo, st, discardLogger())

		resp, err := svc.Save(context.Background(), domain.SaveRequest{SessionID: "s1", PayloadJSON: []byte("{}")}, "author-1")
		if err == nil {
			t.Fatal("expected error")
		}
		if resp.SnapshotID != "" {
			t.Fatal("no snapshot id expected on failure")
		}
		if st.delCalls != 1 {
			t.Fatalf("expected storage.Delete rollback, got %d calls", st.delCalls)
		}
		if st.savedKey == "" {
			t.Fatal("storage.Save should have been called")
		}
	})

	t.Run("Success", func(t *testing.T) {
		sha := storage.ComputeSHA256([]byte("{}"))
		repo := &mockRepo{}
		st := &mockStorage{sha: sha}
		svc := NewSnapshotService(repo, st, discardLogger())

		resp, err := svc.Save(context.Background(), domain.SaveRequest{SessionID: "s1", PayloadJSON: []byte("{}")}, "author-1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.SHA256 != sha {
			t.Fatalf("expected sha256 %s, got %s", sha, resp.SHA256)
		}
		if repo.createCalls != 1 {
			t.Fatal("repo.Create should be called once")
		}
		if st.savedKey != "snapshots/s1/"+resp.SnapshotID+".json.gz" {
			t.Fatalf("unexpected storage key: %s", st.savedKey)
		}
	})
}

func TestSnapshotService_Restore(t *testing.T) {
	payload := []byte(`{"model": true}`)

	t.Run("NotFound", func(t *testing.T) {
		repo := &mockRepo{getErr: domain.ErrSnapshotNotFound}
		st := &mockStorage{}
		svc := NewSnapshotService(repo, st, discardLogger())

		_, err := svc.Restore(context.Background(), "snap-1")
		if !errors.Is(err, domain.ErrSnapshotNotFound) {
			t.Fatalf("expected ErrSnapshotNotFound, got %v", err)
		}
		if st.loadCalls != 0 {
			t.Fatal("storage.Load must not be called when meta missing")
		}
	})

	t.Run("StorageFailed", func(t *testing.T) {
		repo := &mockRepo{meta: domain.SnapshotMeta{StorageKey: "k1"}}
		st := &mockStorage{loadErr: errors.New("s3 down")}
		svc := NewSnapshotService(repo, st, discardLogger())

		_, err := svc.Restore(context.Background(), "snap-1")
		if !errors.Is(err, domain.ErrStorageFailed) {
			t.Fatalf("expected ErrStorageFailed, got %v", err)
		}
	})

	t.Run("SHA256Valid", func(t *testing.T) {
		sha := storage.ComputeSHA256(payload)
		repo := &mockRepo{meta: domain.SnapshotMeta{StorageKey: "k1", SHA256: sha, SchemaVersion: "2.0", ModelTime: 1.5}}
		st := &mockStorage{data: payload}
		svc := NewSnapshotService(repo, st, discardLogger())

		resp, err := svc.Restore(context.Background(), "snap-1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !resp.SHA256Valid {
			t.Fatal("expected sha256 valid")
		}
		if string(resp.PayloadJSON) != string(payload) {
			t.Fatal("payload mismatch")
		}
		if resp.SchemaVersion != "2.0" {
			t.Fatal("schema version mismatch")
		}
	})

	t.Run("SHA256Invalid", func(t *testing.T) {
		repo := &mockRepo{meta: domain.SnapshotMeta{StorageKey: "k1", SHA256: "wronghash"}}
		st := &mockStorage{data: payload}
		svc := NewSnapshotService(repo, st, discardLogger())

		resp, err := svc.Restore(context.Background(), "snap-1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.SHA256Valid {
			t.Fatal("expected sha256 invalid")
		}
	})
}

func TestSnapshotService_Delete(t *testing.T) {
	t.Run("NotPresetDeletes", func(t *testing.T) {
		repo := &mockRepo{meta: domain.SnapshotMeta{IsPreset: false, StorageKey: "k1"}}
		st := &mockStorage{}
		svc := NewSnapshotService(repo, st, discardLogger())

		err := svc.Delete(context.Background(), "snap-1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if st.delCalls != 1 {
			t.Fatal("storage.Delete should be called for non-preset")
		}
		if repo.deleteCalls != 1 {
			t.Fatal("repo.Delete should be called once")
		}
	})

	t.Run("PresetForbidden", func(t *testing.T) {
		repo := &mockRepo{meta: domain.SnapshotMeta{IsPreset: true, StorageKey: "k1"}}
		st := &mockStorage{}
		svc := NewSnapshotService(repo, st, discardLogger())

		err := svc.Delete(context.Background(), "snap-1")
		if !errors.Is(err, domain.ErrPresetDeleteForbidden) {
			t.Fatalf("expected ErrPresetDeleteForbidden, got %v", err)
		}
		if st.delCalls != 0 {
			t.Fatal("storage.Delete must not be called for preset")
		}
		if repo.deleteCalls != 0 {
			t.Fatal("repo.Delete must not be called for preset")
		}
	})

	t.Run("StorageDeleteErrorStillRepoDelete", func(t *testing.T) {
		repo := &mockRepo{meta: domain.SnapshotMeta{IsPreset: false, StorageKey: "k1"}}
		st := &mockStorage{deleteErr: errors.New("s3 down")}
		svc := NewSnapshotService(repo, st, discardLogger())

		err := svc.Delete(context.Background(), "snap-1")
		if err != nil {
			t.Fatalf("storage delete error should be soft, got %v", err)
		}
		if repo.deleteCalls != 1 {
			t.Fatal("repo.Delete should still be called on storage soft-failure")
		}
	})
}

func TestSnapshotService_List(t *testing.T) {
	t.Run("DefaultLimit", func(t *testing.T) {
		repo := &mockRepo{}
		st := &mockStorage{}
		svc := NewSnapshotService(repo, st, discardLogger())

		_, err := svc.List(context.Background(), "s1", nil, 0, 0)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if repo.listCalls != 1 {
			t.Fatal("repo.List should be called once")
		}
	})

	t.Run("ClampedLimit", func(t *testing.T) {
		repo := &mockRepo{}
		st := &mockStorage{}
		svc := NewSnapshotService(repo, st, discardLogger())

		_, err := svc.List(context.Background(), "s1", nil, 9999, 0)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}
