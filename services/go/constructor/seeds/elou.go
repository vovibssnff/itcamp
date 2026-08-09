package seeds

import "github.com/itcamp/ktc/services/constructor/internal/domain"

func elouComponents() []domain.ComponentType {
	return []domain.ComponentType{
		{
			ID: "electro_dehydrator", Name: "Электродегидратор", Category: domain.CategoryELOU,
			Description: "Уровень раздела фаз, U/I электродов, блокировки HV (уровень <3500 мм, ток 90 А, газ. подушка), эффективность обессоливания",
			Ports: []domain.Port{
				{ID: "feed_in", Name: "Вход сырья", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
				{ID: "oil_out", Name: "Выход нефти (верх)", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
				{ID: "water_out", Name: "Выход воды (низ)", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
				{ID: "hv", Name: "Подключение HV", Type: domain.PortElectric, Direction: domain.PortIn, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "P_work", Name: "Раб. давление", Unit: "кгс/см2", Type: domain.ParamFloat, Default: float64(8), Min: pFloat(4.5), Max: pFloat(16)},
				{ID: "T_work", Name: "Раб. температура", Unit: "°C", Type: domain.ParamFloat, Default: float64(120), Min: pFloat(0), Max: pFloat(200)},
				{ID: "V", Name: "Объём", Unit: "м3", Type: domain.ParamFloat, Default: float64(160), Min: pFloat(0), Max: pFloat(500)},
				{ID: "D", Name: "Диаметр", Unit: "мм", Type: domain.ParamFloat, Default: float64(3400)},
				{ID: "L", Name: "Длина", Unit: "мм", Type: domain.ParamFloat, Default: float64(18850)},
				{ID: "U_top", Name: "Напряжение верх", Unit: "кВ", Type: domain.ParamFloat, Default: float64(4.8), Min: pFloat(0), Max: pFloat(50)},
				{ID: "U_bottom", Name: "Напряжение низ", Unit: "кВ", Type: domain.ParamFloat, Default: float64(4.5), Min: pFloat(0), Max: pFloat(50)},
				{ID: "I_max", Name: "Макс. ток", Unit: "А", Type: domain.ParamFloat, Default: float64(90), Min: pFloat(0), Max: pFloat(500)},
				{ID: "level_min", Name: "Мин. уровень блокировки", Unit: "мм", Type: domain.ParamFloat, Default: float64(3500)},
				{ID: "efficiency", Name: "Эффективность обессоливания", Unit: "%", Type: domain.ParamFloat, Default: float64(90), Min: pFloat(0), Max: pFloat(100)},
			},
			ModelCode: "electro_dehydrator",
		},
		{
			ID: "ipm", Name: "ИПМ (источник питания высоковольтный)", Category: domain.CategoryELOU,
			Description: "U верх 4,8 кВ / низ 4,5 кВ, блокировки T масла>80°C, КЗ, перегрузка тиристоров",
			Ports: []domain.Port{
				{ID: "power_in", Name: "Вход 0,4 кВ", Type: domain.PortElectric, Direction: domain.PortIn, Required: true},
				{ID: "hv_top", Name: "Выход HV (верх)", Type: domain.PortElectric, Direction: domain.PortOut, Required: true},
				{ID: "hv_bottom", Name: "Выход HV (низ)", Type: domain.PortElectric, Direction: domain.PortOut, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "U_top", Name: "Напряжение верх", Unit: "кВ", Type: domain.ParamFloat, Default: float64(4.8)},
				{ID: "U_bottom", Name: "Напряжение низ", Unit: "кВ", Type: domain.ParamFloat, Default: float64(4.5)},
				{ID: "T_oil_max", Name: "Макс. T масла", Unit: "°C", Type: domain.ParamFloat, Default: float64(80)},
			},
			ModelCode: "ipm",
		},
		{
			ID: "step_up_transformer", Name: "Повышающий трансформатор", Category: domain.CategoryELOU,
			Description: "11/16,5/22 кВ, переключение ступеней",
			Ports: []domain.Port{
				{ID: "power_in", Name: "Вход 0,4 кВ", Type: domain.PortElectric, Direction: domain.PortIn, Required: true},
				{ID: "hv_out", Name: "Выход HV", Type: domain.PortElectric, Direction: domain.PortOut, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "U_out", Name: "Выходное напряжение", Unit: "кВ", Type: domain.ParamSelect, Default: "11", Options: []string{"11", "16.5", "22"}},
			},
			ModelCode: "step_up_transformer",
		},
		{
			ID: "reagent_doser", Name: "Дозатор реагента", Category: domain.CategoryELOU,
			Description: "Деэмульгатор, Q дозировки",
			Ports: []domain.Port{
				{ID: "reagent_in", Name: "Вход реагента", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
				{ID: "outlet", Name: "Выход (в линию)", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "Q_dose", Name: "Расход дозировки", Unit: "л/ч", Type: domain.ParamFloat, Default: float64(0.025), Min: pFloat(0), Max: pFloat(100)},
				{ID: "reagent_type", Name: "Тип реагента", Type: domain.ParamSelect, Default: "demulsifier", Options: []string{"demulsifier", "inhibitor", "neutralizer"}},
			},
			ModelCode: "reagent_doser",
		},
	}
}
