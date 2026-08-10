package service

import (
	"testing"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
)

func TestMergeTemplateUpdate_PreservesPublishedStatus(t *testing.T) {
	existing := domain.Template{
		ID:     "t-1",
		Status: domain.StatusPublished,
		Graph:  domain.Graph{SchemaVersion: "2.0"},
	}
	incoming := domain.Template{
		ID:   "t-1",
		Name: "updated name",
		Graph: domain.Graph{
			Nodes: []domain.Node{{ID: "n1", ComponentTypeID: "pump"}},
		},
	}

	got := mergeTemplateUpdate(existing, incoming)
	if got.Status != domain.StatusPublished {
		t.Fatalf("status = %q, want %q (PUT must not demote published templates)", got.Status, domain.StatusPublished)
	}
	if got.Graph.SchemaVersion != "2.0" {
		t.Fatalf("schema_version = %q, want 2.0", got.Graph.SchemaVersion)
	}
	if got.Name != "updated name" {
		t.Fatalf("name = %q, want updated name", got.Name)
	}
}

func TestMergeTemplateUpdate_PreservesArchivedStatus(t *testing.T) {
	existing := domain.Template{Status: domain.StatusArchived, Graph: domain.Graph{SchemaVersion: "2.0"}}
	incoming := domain.Template{Name: "x", Graph: domain.Graph{}}

	got := mergeTemplateUpdate(existing, incoming)
	if got.Status != domain.StatusArchived {
		t.Fatalf("status = %q, want %q", got.Status, domain.StatusArchived)
	}
}

func TestMergeTemplateUpdate_KeepsExplicitStatus(t *testing.T) {
	existing := domain.Template{Status: domain.StatusPublished}
	incoming := domain.Template{Status: domain.StatusDraft}

	got := mergeTemplateUpdate(existing, incoming)
	if got.Status != domain.StatusDraft {
		t.Fatalf("status = %q, want explicit draft", got.Status)
	}
}
