package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/itcamp/ktc/services/assessment/internal/domain"
)

type ScenarioClient interface {
	GetScenario(ctx context.Context, scenarioID string) (domain.ScenarioData, error)
}

type HTTPScenarioClient struct {
	url    string
	client *http.Client
}

func NewHTTPScenarioClient(url string) *HTTPScenarioClient {
	return &HTTPScenarioClient{url: url, client: &http.Client{}}
}

func (c *HTTPScenarioClient) GetScenario(ctx context.Context, scenarioID string) (domain.ScenarioData, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url+"/scenarios/"+scenarioID+"/full", nil)
	if err != nil {
		return domain.ScenarioData{}, err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return domain.ScenarioData{}, fmt.Errorf("scenario client: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return domain.ScenarioData{}, fmt.Errorf("scenario client: status %d", resp.StatusCode)
	}
	var raw struct {
		ReferenceActions []domain.ReferenceAction `json:"reference_actions"`
		Criteria         domain.Criteria          `json:"criteria"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return domain.ScenarioData{}, err
	}
	return domain.ScenarioData{ReferenceActions: raw.ReferenceActions, Criteria: raw.Criteria}, nil
}

type MockScenarioClient struct {
	Data map[string]domain.ScenarioData
}

func NewMockScenarioClient() *MockScenarioClient {
	return &MockScenarioClient{Data: make(map[string]domain.ScenarioData)}
}

func (m *MockScenarioClient) GetScenario(_ context.Context, scenarioID string) (domain.ScenarioData, error) {
	data, ok := m.Data[scenarioID]
	if !ok {
		return domain.ScenarioData{}, fmt.Errorf("scenario %s not found", scenarioID)
	}
	return data, nil
}
