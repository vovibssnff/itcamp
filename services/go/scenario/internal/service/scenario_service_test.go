package service

import (
	"context"
	"testing"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
)

type mockScenarioRepo struct {
	items map[string]domain.Scenario
}

func newMockScenarioRepo() *mockScenarioRepo {
	return &mockScenarioRepo{items: make(map[string]domain.Scenario)}
}

func (m *mockScenarioRepo) GetByID(_ context.Context, id string) (domain.Scenario, error) {
	s, ok := m.items[id]
	if !ok {
		return domain.Scenario{}, domain.ErrScenarioNotFound
	}
	return s, nil
}

func (m *mockScenarioRepo) List(_ context.Context, _, _, _ string, _, _ int) ([]domain.Scenario, error) {
	var result []domain.Scenario
	for _, s := range m.items {
		result = append(result, s)
	}
	return result, nil
}

func (m *mockScenarioRepo) Create(_ context.Context, s domain.Scenario) error {
	m.items[s.ID] = s
	return nil
}

func (m *mockScenarioRepo) Upsert(_ context.Context, s domain.Scenario) error {
	m.items[s.ID] = s
	return nil
}

func (m *mockScenarioRepo) Update(_ context.Context, s domain.Scenario) error {
	if _, ok := m.items[s.ID]; !ok {
		return domain.ErrScenarioNotFound
	}
	m.items[s.ID] = s
	return nil
}

func (m *mockScenarioRepo) Delete(_ context.Context, id string) error {
	if _, ok := m.items[id]; !ok {
		return domain.ErrScenarioNotFound
	}
	delete(m.items, id)
	return nil
}

func (m *mockScenarioRepo) GetRandomExam(_ context.Context, _ string) (domain.Scenario, error) {
	for _, s := range m.items {
		if s.Type == domain.ScenarioExam {
			return s, nil
		}
	}
	return domain.Scenario{}, domain.ErrScenarioNotFound
}

func (m *mockScenarioRepo) Clone(_ context.Context, id, newTemplateID string) (domain.Scenario, error) {
	original, ok := m.items[id]
	if !ok {
		return domain.Scenario{}, domain.ErrScenarioNotFound
	}
	clone := original
	clone.ID = "clone-" + id
	clone.TemplateID = newTemplateID
	clone.Name = original.Name + " (копия)"
	m.items[clone.ID] = clone
	return clone, nil
}

func testScenarioService() (*ScenarioService, *mockScenarioRepo) {
	repo := newMockScenarioRepo()
	svc := NewScenarioService(repo, NewTriggerValidator())
	return svc, repo
}

func TestScenarioService_Create(t *testing.T) {
	svc, _ := testScenarioService()
	t120 := float64(120)
	s, err := svc.Create(context.Background(), domain.Scenario{
		Name: "Test", Type: domain.ScenarioTraining,
		Faults: []domain.ScenarioFault{
			{ID: "f1", FaultID: "test", ComponentInstanceID: "c1",
				Trigger: domain.Trigger{Type: domain.TriggerTime, AtModelTime: &t120}},
		},
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	if s.ID == "" {
		t.Error("expected non-empty ID")
	}
}

func TestScenarioService_Create_InvalidTrigger(t *testing.T) {
	svc, _ := testScenarioService()
	_, err := svc.Create(context.Background(), domain.Scenario{
		Name: "Test",
		Faults: []domain.ScenarioFault{
			{ID: "f1", FaultID: "test", Trigger: domain.Trigger{Type: "unknown"}},
		},
	})
	if err == nil {
		t.Fatal("expected validation error")
	}
}

func TestScenarioService_Get(t *testing.T) {
	svc, repo := testScenarioService()
	repo.items["s1"] = domain.Scenario{ID: "s1", Name: "Test"}
	s, err := svc.Get(context.Background(), "s1")
	if err != nil {
		t.Fatalf("get failed: %v", err)
	}
	if s.Name != "Test" {
		t.Errorf("expected Test, got %s", s.Name)
	}
}

func TestScenarioService_Get_NotFound(t *testing.T) {
	svc, _ := testScenarioService()
	_, err := svc.Get(context.Background(), "nonexistent")
	if err == nil {
		t.Fatal("expected not found")
	}
}

func TestScenarioService_List(t *testing.T) {
	svc, repo := testScenarioService()
	repo.items["s1"] = domain.Scenario{ID: "s1", Name: "A"}
	repo.items["s2"] = domain.Scenario{ID: "s2", Name: "B"}
	list, err := svc.List(context.Background(), "", "", "", 50, 0)
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(list) != 2 {
		t.Errorf("expected 2, got %d", len(list))
	}
}

func TestScenarioService_Update(t *testing.T) {
	svc, repo := testScenarioService()
	repo.items["s1"] = domain.Scenario{ID: "s1", Name: "Old", Type: domain.ScenarioTraining}
	_, err := svc.Update(context.Background(), domain.Scenario{ID: "s1", Name: "New", Type: domain.ScenarioTraining})
	if err != nil {
		t.Fatalf("update failed: %v", err)
	}
	if repo.items["s1"].Name != "New" {
		t.Errorf("expected New, got %s", repo.items["s1"].Name)
	}
}

func TestScenarioService_Delete(t *testing.T) {
	svc, repo := testScenarioService()
	repo.items["s1"] = domain.Scenario{ID: "s1", Name: "Test"}
	if err := svc.Delete(context.Background(), "s1"); err != nil {
		t.Fatalf("delete failed: %v", err)
	}
	if _, ok := repo.items["s1"]; ok {
		t.Error("expected deleted")
	}
}

func TestScenarioService_Clone(t *testing.T) {
	svc, repo := testScenarioService()
	repo.items["s1"] = domain.Scenario{ID: "s1", Name: "Original", TemplateID: "t1"}
	clone, err := svc.Clone(context.Background(), "s1", "t2")
	if err != nil {
		t.Fatalf("clone failed: %v", err)
	}
	if clone.TemplateID != "t2" {
		t.Errorf("expected t2, got %s", clone.TemplateID)
	}
	if clone.Name != "Original (копия)" {
		t.Errorf("expected copy name, got %s", clone.Name)
	}
}

func TestScenarioService_GetRandomExam(t *testing.T) {
	svc, repo := testScenarioService()
	repo.items["s1"] = domain.Scenario{ID: "s1", Type: domain.ScenarioExam, Name: "Exam1"}
	repo.items["s2"] = domain.Scenario{ID: "s2", Type: domain.ScenarioTraining, Name: "Train1"}
	exam, err := svc.GetRandomExam(context.Background(), "")
	if err != nil {
		t.Fatalf("exam failed: %v", err)
	}
	if exam.Type != domain.ScenarioExam {
		t.Errorf("expected exam, got %s", exam.Type)
	}
}

func TestScenarioService_GetRandomExam_NotFound(t *testing.T) {
	svc, _ := testScenarioService()
	_, err := svc.GetRandomExam(context.Background(), "")
	if err == nil {
		t.Fatal("expected not found")
	}
}
