package domain

type PortDirection string

const (
	PortIn  PortDirection = "in"
	PortOut PortDirection = "out"
)

type PortType string

const (
	PortLiquid   PortType = "liquid"
	PortGas      PortType = "gas"
	PortSteam    PortType = "steam"
	PortElectric PortType = "electric"
	PortSignal   PortType = "signal"
)

type Port struct {
	ID        string        `json:"id"`
	Name      string        `json:"name"`
	Type      PortType      `json:"type"`
	Direction PortDirection `json:"direction"`
	Required  bool          `json:"required"`
}

type ParameterType string

const (
	ParamFloat  ParameterType = "float"
	ParamInt    ParameterType = "int"
	ParamBool   ParameterType = "bool"
	ParamString ParameterType = "string"
	ParamSelect ParameterType = "select"
)

type Parameter struct {
	ID      string        `json:"id"`
	Name    string        `json:"name"`
	Unit    string        `json:"unit"`
	Type    ParameterType `json:"type"`
	Default any           `json:"default"`
	Min     *float64      `json:"min,omitempty"`
	Max     *float64      `json:"max,omitempty"`
	Options []string      `json:"options,omitempty"`
}

type Category string

const (
	CategoryCommon     Category = "Общие"
	CategoryELOU       Category = "ЭЛОУ"
	CategoryAtmosphere Category = "Атмосфера"
	CategoryGDM        Category = "ГДМ"
)

type ComponentType struct {
	ID            string      `json:"id"`
	Name          string      `json:"name"`
	Category      Category    `json:"category"`
	Description   string      `json:"description"`
	Ports         []Port      `json:"ports"`
	Parameters    []Parameter `json:"parameters"`
	ModelCode     string      `json:"model_code"`
	IconS3Key     string      `json:"icon_s3_key"`
	Documentation string      `json:"documentation"`
}
