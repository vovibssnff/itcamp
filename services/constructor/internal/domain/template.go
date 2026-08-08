package domain

type TemplateStatus string

const (
	StatusDraft     TemplateStatus = "draft"
	StatusPublished TemplateStatus = "published"
	StatusArchived  TemplateStatus = "archived"
)

type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type PortConnection struct {
	Type         string `json:"type"`
	ConnectedTo  string `json:"connected_to"`
}

type Node struct {
	ID               string            `json:"id"`
	ComponentTypeID  string            `json:"component_type_id"`
	Label            string            `json:"label"`
	Position         Position          `json:"position"`
	Parameters       map[string]any    `json:"parameters"`
	Ports            map[string]PortConnection `json:"ports"`
}

type EdgeEndpoint struct {
	NodeID string `json:"node_id"`
	Port   string `json:"port"`
}

type Edge struct {
	ID   string       `json:"id"`
	Type PortType     `json:"type"`
	From EdgeEndpoint `json:"from"`
	To   EdgeEndpoint `json:"to"`
}

type Layout struct {
	MnemoPositions map[string]Position `json:"mnemo_positions"`
	CustomLabels   map[string]string   `json:"custom_labels"`
}

type Graph struct {
	SchemaVersion string  `json:"schema_version"`
	Nodes         []Node  `json:"nodes"`
	Edges         []Edge  `json:"edges"`
	Layout        Layout  `json:"layout"`
}

type Template struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	AuthorID    string         `json:"author_id"`
	Status      TemplateStatus `json:"status"`
	Graph       Graph          `json:"graph"`
	CreatedAt   string         `json:"created_at"`
	UpdatedAt   string         `json:"updated_at"`
}
