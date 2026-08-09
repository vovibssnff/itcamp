package seeds

import "github.com/itcamp/ktc/services/constructor/internal/domain"

func gdmComponents() []domain.ComponentType {
	return []domain.ComponentType{
		{
			ID: "catalytic_reactor", Name: "Реактор каталитический", Category: domain.CategoryGDM,
			Description: "Многозонный T-профиль, расход ВСГ ≥300 кг/ч, парциальное давление H2",
			Ports: []domain.Port{
				{ID: "feed_in", Name: "Вход сырья", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
				{ID: "h2_in", Name: "Вход ВСГ", Type: domain.PortGas, Direction: domain.PortIn, Required: true},
				{ID: "product_out", Name: "Выход продукта", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
				{ID: "gas_out", Name: "Выход газа", Type: domain.PortGas, Direction: domain.PortOut, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "T_profile", Name: "T-профиль (зоны)", Unit: "°C", Type: domain.ParamString, Default: "180-220"},
				{ID: "P_work", Name: "Раб. давление", Unit: "кгс/см2", Type: domain.ParamFloat, Default: float64(5), Min: pFloat(1), Max: pFloat(10)},
				{ID: "h2_flow_min", Name: "Мин. расход ВСГ", Unit: "кг/ч", Type: domain.ParamFloat, Default: float64(300), Min: pFloat(0), Max: pFloat(5000)},
				{ID: "D", Name: "Диаметр", Unit: "мм", Type: domain.ParamFloat, Default: float64(2600)},
				{ID: "H", Name: "Высота", Unit: "мм", Type: domain.ParamFloat, Default: float64(8575)},
				{ID: "V", Name: "Объём", Unit: "м3", Type: domain.ParamFloat, Default: float64(30)},
				{ID: "P_calc", Name: "Расч. давление", Unit: "кгс/см2", Type: domain.ParamFloat, Default: float64(10)},
				{ID: "T_calc", Name: "Расч. температура", Unit: "°C", Type: domain.ParamFloat, Default: float64(250)},
			},
			ModelCode: "catalytic_reactor",
		},
		{
			ID: "gdm_stripping", Name: "Отпарная колонна ГДМ (К-12/2, К-12/3)", Category: domain.CategoryGDM,
			Description: "P, T, уровень (осн.+дубл.), расход пара",
			Ports: []domain.Port{
				{ID: "feed_in", Name: "Вход", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
				{ID: "product_out", Name: "Выход продукта", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
				{ID: "steam_in", Name: "Вход перегретого пара", Type: domain.PortSteam, Direction: domain.PortIn, Required: true},
				{ID: "vapor_out", Name: "Выход паров", Type: domain.PortGas, Direction: domain.PortOut, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "P_work", Name: "Раб. давление", Unit: "кгс/см2", Type: domain.ParamFloat, Default: float64(8), Min: pFloat(1), Max: pFloat(15)},
				{ID: "T_work", Name: "Раб. температура", Unit: "°C", Type: domain.ParamFloat, Default: float64(220)},
				{ID: "N_trays", Name: "Число тарелок", Type: domain.ParamInt, Default: float64(4), Min: pFloat(1), Max: pFloat(20)},
				{ID: "D", Name: "Диаметр", Unit: "мм", Type: domain.ParamFloat, Default: float64(3000)},
				{ID: "H", Name: "Высота", Unit: "мм", Type: domain.ParamFloat, Default: float64(40510)},
			},
			ModelCode: "gdm_stripping",
		},
		{
			ID: "demister", Name: "Каплеотбойник", Category: domain.CategoryGDM,
			Description: "Эффективность, P, сепарация капель перед факелом",
			Ports: []domain.Port{
				{ID: "mixture_in", Name: "Вход (газ+капли)", Type: domain.PortGas, Direction: domain.PortIn, Required: true},
				{ID: "gas_out", Name: "Выход газа (на факел)", Type: domain.PortGas, Direction: domain.PortOut, Required: true},
				{ID: "liquid_out", Name: "Выход жидкости (возврат)", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "efficiency", Name: "Эффективность", Unit: "%", Type: domain.ParamFloat, Default: float64(99), Min: pFloat(0), Max: pFloat(100)},
				{ID: "P_work", Name: "Раб. давление", Unit: "кгс/см2", Type: domain.ParamFloat, Default: float64(5)},
			},
			ModelCode: "demister",
		},
		{
			ID: "steam_superheater", Name: "Пароперегреватель", Category: domain.CategoryGDM,
			Description: "T выхода, расход, перегрев пара для К-12/3",
			Ports: []domain.Port{
				{ID: "steam_in", Name: "Вход пара (насыщенный)", Type: domain.PortSteam, Direction: domain.PortIn, Required: true},
				{ID: "steam_out", Name: "Выход пара (перегретый)", Type: domain.PortSteam, Direction: domain.PortOut, Required: true},
				{ID: "heat_in", Name: "Источник тепла", Type: domain.PortGas, Direction: domain.PortIn, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "T_out", Name: "T выхода пара", Unit: "°C", Type: domain.ParamFloat, Default: float64(250), Min: pFloat(100), Max: pFloat(500)},
				{ID: "F", Name: "Расход пара", Unit: "кг/ч", Type: domain.ParamFloat, Default: float64(1200), Min: pFloat(0), Max: pFloat(10000)},
			},
			ModelCode: "steam_superheater",
		},
	}
}
