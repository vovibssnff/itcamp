package service

import (
	"context"
	"testing"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
)

type mockFaultRepo struct {
	items map[string]domain.Fault
}

func newMockFaultRepo() *mockFaultRepo {
	return &mockFaultRepo{items: make(map[string]domain.Fault)}
}

func (m *mockFaultRepo) GetByID(_ context.Context, id string) (domain.Fault, error) {
	f, ok := m.items[id]
	if !ok {
		return domain.Fault{}, domain.ErrFaultNotFound
	}
	return f, nil
}

func (m *mockFaultRepo) List(_ context.Context, _, _ string) ([]domain.Fault, error) {
	out := make([]domain.Fault, 0, len(m.items))
	for _, f := range m.items {
		out = append(out, f)
	}
	return out, nil
}

func (m *mockFaultRepo) Upsert(_ context.Context, f domain.Fault) error {
	m.items[f.FaultID] = f
	return nil
}

func validFault(id string) domain.Fault {
	return domain.Fault{
		FaultID:                  id,
		Name:                     "Fault " + id,
		ApplicableComponentTypes: []string{"vessel"},
		Severity:                 domain.SeverityHigh,
		DamagePerSec:             0.5,
	}
}

func TestValidateFault_OK(t *testing.T) {
	if err := ValidateFault(validFault("f1")); err != nil {
		t.Fatal(err)
	}
}

func TestValidateFault_Errors(t *testing.T) {
	cases := []domain.Fault{
		{Name: "n", ApplicableComponentTypes: []string{"x"}, Severity: domain.SeverityLow},
		{FaultID: "f", ApplicableComponentTypes: []string{"x"}, Severity: domain.SeverityLow},
		{FaultID: "f", Name: "n", Severity: domain.SeverityLow},
		{FaultID: "f", Name: "n", ApplicableComponentTypes: []string{"x"}, Severity: "nope"},
	}
	for i, f := range cases {
		if err := ValidateFault(f); err == nil {
			t.Fatalf("case %d: expected error", i)
		}
	}
}

func TestFaultService_Import(t *testing.T) {
	repo := newMockFaultRepo()
	svc := NewFaultService(repo)
	_ = repo.Upsert(context.Background(), validFault("existing"))

	result := svc.Import(context.Background(), []domain.Fault{
		validFault("existing"),
		validFault("new"),
		{FaultID: "bad", Name: "", Severity: domain.SeverityLow, ApplicableComponentTypes: []string{"x"}},
		validFault("new"),
	})
	if result.Created != 1 || result.Updated != 1 || len(result.Errors) != 2 {
		t.Fatalf("got %+v", result)
	}
}
