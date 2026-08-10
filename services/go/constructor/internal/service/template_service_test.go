package service

import (
	"context"
	"testing"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
)

type mockTemplateRepo struct {
	items map[string]domain.Template
}

func newMockTemplateRepo() *mockTemplateRepo {
	return &mockTemplateRepo{items: make(map[string]domain.Template)}
}

func (m *mockTemplateRepo) GetByID(_ context.Context, id string) (domain.Template, error) {
	t, ok := m.items[id]
	if !ok {
		return domain.Template{}, domain.ErrTemplateNotFound
	}
	return t, nil
}

func (m *mockTemplateRepo) List(_ context.Context, _, _, _ string, _, _ int) ([]domain.Template, error) {
	out := make([]domain.Template, 0, len(m.items))
	for _, t := range m.items {
		out = append(out, t)
	}
	return out, nil
}

func (m *mockTemplateRepo) Create(_ context.Context, t domain.Template) error {
	m.items[t.ID] = t
	return nil
}

func (m *mockTemplateRepo) Update(_ context.Context, t domain.Template) error {
	m.items[t.ID] = t
	return nil
}

func (m *mockTemplateRepo) Delete(_ context.Context, id string) error {
	delete(m.items, id)
	return nil
}

func (m *mockTemplateRepo) UpdateStatus(_ context.Context, id string, status domain.TemplateStatus) error {
	t, ok := m.items[id]
	if !ok {
		return domain.ErrTemplateNotFound
	}
	t.Status = status
	m.items[id] = t
	return nil
}

func (m *mockTemplateRepo) DeepClone(_ context.Context, id, newName string) (domain.Template, error) {
	t, ok := m.items[id]
	if !ok {
		return domain.Template{}, domain.ErrTemplateNotFound
	}
	clone := t
	clone.ID = "clone-" + id
	clone.Name = newName
	m.items[clone.ID] = clone
	return clone, nil
}

func TestTemplateService_Import_ValidGraph(t *testing.T) {
	lookup := testComponentLookup()
	svc := NewTemplateService(newMockTemplateRepo(), NewValidator(lookup), NewExporter(lookup))
	result, err := svc.Import(context.Background(), domain.Template{
		Name:  "Mini",
		Graph: validGraph(),
	})
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	if result.Template.ID == "" || result.Template.Status != domain.StatusDraft {
		t.Fatalf("bad template: %+v", result.Template)
	}
	if !result.Validation.Valid {
		t.Fatalf("expected valid: %+v", result.Validation.Errors)
	}
}

func TestTemplateService_Import_InvalidGraphStillCreated(t *testing.T) {
	lookup := testComponentLookup()
	svc := NewTemplateService(newMockTemplateRepo(), NewValidator(lookup), NewExporter(lookup))
	result, err := svc.Import(context.Background(), domain.Template{
		Name:  "Empty",
		Graph: domain.Graph{},
	})
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	if result.Validation.Valid {
		t.Fatal("expected invalid validation")
	}
	if result.Template.ID == "" {
		t.Fatal("template should still be created")
	}
}

func TestTemplateService_ExportFile(t *testing.T) {
	lookup := testComponentLookup()
	repo := newMockTemplateRepo()
	svc := NewTemplateService(repo, NewValidator(lookup), NewExporter(lookup))
	created, err := svc.Create(context.Background(), domain.Template{Name: "X", Graph: validGraph()})
	if err != nil {
		t.Fatal(err)
	}
	g, err := svc.ExportFile(context.Background(), created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(g.Nodes) != 3 {
		t.Fatalf("nodes=%d", len(g.Nodes))
	}
}
