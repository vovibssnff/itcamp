package service

import (
	"context"
	"testing"

	"github.com/itcamp/ktc/services/constructor/internal/domain"
)

type mockComponentRepo struct {
	items map[string]domain.ComponentType
}

func newMockComponentRepo() *mockComponentRepo {
	return &mockComponentRepo{items: make(map[string]domain.ComponentType)}
}

func (m *mockComponentRepo) GetByID(_ context.Context, id string) (domain.ComponentType, error) {
	c, ok := m.items[id]
	if !ok {
		return domain.ComponentType{}, domain.ErrComponentNotFound
	}
	return c, nil
}

func (m *mockComponentRepo) List(_ context.Context, _, _ string, _, _ int) ([]domain.ComponentType, error) {
	out := make([]domain.ComponentType, 0, len(m.items))
	for _, c := range m.items {
		out = append(out, c)
	}
	return out, nil
}

func (m *mockComponentRepo) Create(_ context.Context, c domain.ComponentType) error {
	m.items[c.ID] = c
	return nil
}

func (m *mockComponentRepo) Update(_ context.Context, c domain.ComponentType) error {
	if _, ok := m.items[c.ID]; !ok {
		return domain.ErrComponentNotFound
	}
	m.items[c.ID] = c
	return nil
}

func (m *mockComponentRepo) Delete(_ context.Context, id string) error {
	delete(m.items, id)
	return nil
}

func (m *mockComponentRepo) Upsert(_ context.Context, c domain.ComponentType) error {
	m.items[c.ID] = c
	return nil
}

func (m *mockComponentRepo) IsUsedInTemplates(_ context.Context, _ string) (bool, error) {
	return false, nil
}

func validComponent(id string) domain.ComponentType {
	return domain.ComponentType{
		ID:        id,
		Name:      "Test " + id,
		Category:  domain.CategoryCommon,
		ModelCode: id,
		Ports: []domain.Port{
			{ID: "outlet", Name: "Out", Type: domain.PortLiquid, Direction: domain.PortOut},
		},
		Parameters: []domain.Parameter{
			{ID: "q", Name: "Q", Type: domain.ParamFloat, Default: 1.0},
		},
	}
}

func TestValidateComponent_OK(t *testing.T) {
	if err := ValidateComponent(validComponent("source")); err != nil {
		t.Fatalf("unexpected: %v", err)
	}
}

func TestValidateComponent_MissingFields(t *testing.T) {
	cases := []struct {
		name string
		c    domain.ComponentType
	}{
		{"empty id", domain.ComponentType{Name: "x", Category: domain.CategoryCommon, ModelCode: "m"}},
		{"empty name", domain.ComponentType{ID: "x", Category: domain.CategoryCommon, ModelCode: "m"}},
		{"empty model", domain.ComponentType{ID: "x", Name: "n", Category: domain.CategoryCommon}},
		{"bad category", domain.ComponentType{ID: "x", Name: "n", Category: "nope", ModelCode: "m"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := ValidateComponent(tc.c); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}

func TestValidateComponent_BadPort(t *testing.T) {
	c := validComponent("p")
	c.Ports[0].Type = "plasma"
	if err := ValidateComponent(c); err == nil {
		t.Fatal("expected port type error")
	}
}

func TestComponentService_Import_CreateUpdateAndErrors(t *testing.T) {
	repo := newMockComponentRepo()
	svc := NewComponentService(repo)

	existing := validComponent("source")
	_ = repo.Upsert(context.Background(), existing)

	result := svc.Import(context.Background(), []domain.ComponentType{
		validComponent("source"), // update
		validComponent("sink"),   // create
		{ID: "bad", Name: "", Category: domain.CategoryCommon, ModelCode: "bad"},
		validComponent("sink"), // duplicate in payload
	})

	if result.Created != 1 {
		t.Fatalf("created=%d want 1", result.Created)
	}
	if result.Updated != 1 {
		t.Fatalf("updated=%d want 1", result.Updated)
	}
	if len(result.Errors) != 2 {
		t.Fatalf("errors=%d want 2: %+v", len(result.Errors), result.Errors)
	}
	if _, ok := repo.items["sink"]; !ok {
		t.Fatal("sink not upserted")
	}
}
