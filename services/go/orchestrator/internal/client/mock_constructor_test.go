package client

import (
	"context"
	"testing"
)

func TestMockConstructorClient_ExportTemplate_DefaultPayload(t *testing.T) {
	c := NewMockConstructorClient()
	payload, err := c.ExportTemplate(context.Background(), "tmpl-1")
	if err != nil {
		t.Fatalf("ExportTemplate: %v", err)
	}
	if len(payload) == 0 {
		t.Fatal("expected non-empty init-state payload")
	}
}

func TestMockConstructorClient_ExportTemplate_CustomPayload(t *testing.T) {
	c := NewMockConstructorClient()
	c.Exports["tmpl-2"] = []byte(`{"custom":true}`)
	payload, err := c.ExportTemplate(context.Background(), "tmpl-2")
	if err != nil {
		t.Fatalf("ExportTemplate: %v", err)
	}
	if string(payload) != `{"custom":true}` {
		t.Fatalf("payload = %s, want custom", payload)
	}
}
