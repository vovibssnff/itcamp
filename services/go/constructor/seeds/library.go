package seeds

import "github.com/itcamp/ktc/services/constructor/internal/domain"

func Library() []domain.ComponentType {
	var all []domain.ComponentType
	all = append(all, commonComponents()...)
	all = append(all, elouComponents()...)
	all = append(all, atmosphereComponents()...)
	all = append(all, gdmComponents()...)
	return all
}

func commonComponents() []domain.ComponentType {
	return []domain.ComponentType{
		{
			ID: "centrifugal_pump", Name: "Центробежный насос", Category: domain.CategoryCommon,
			Description: "Q-H характеристика, кавитация, резервирование",
			Ports: []domain.Port{
				{ID: "inlet", Name: "Вход", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
				{ID: "outlet", Name: "Выход", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "Q_nom", Name: "Номинальная подача", Unit: "м3/ч", Type: domain.ParamFloat, Default: float64(450), Min: pFloat(0), Max: pFloat(2000)},
				{ID: "P_max", Name: "Макс. напор", Unit: "кгс/см2", Type: domain.ParamFloat, Default: float64(20), Min: pFloat(0), Max: pFloat(50)},
				{ID: "N_kw", Name: "Мощность э/дв", Unit: "кВт", Type: domain.ParamFloat, Default: float64(400), Min: pFloat(0), Max: pFloat(2000)},
				{ID: "rpm", Name: "Частота вращения", Unit: "об/мин", Type: domain.ParamInt, Default: float64(2950), Min: pFloat(0), Max: pFloat(6000)},
			},
			ModelCode: "centrifugal_pump",
		},
		{
			ID: "heat_exchanger", Name: "Теплообменник кожухотрубчатый", Category: domain.CategoryCommon,
			Description: "Q = K·F·ΔT_лм, противоток",
			Ports: []domain.Port{
				{ID: "tube_in", Name: "Вход трубного", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
				{ID: "tube_out", Name: "Выход трубного", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
				{ID: "shell_in", Name: "Вход межтрубного", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
				{ID: "shell_out", Name: "Выход межтрубного", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "F", Name: "Поверхность теплообмена", Unit: "м2", Type: domain.ParamFloat, Default: float64(400), Min: pFloat(0), Max: pFloat(10000)},
				{ID: "K", Name: "Коэф. теплопередачи", Unit: "Вт/(м2·К)", Type: domain.ParamFloat, Default: float64(250), Min: pFloat(0), Max: pFloat(1000)},
				{ID: "D", Name: "Диаметр", Unit: "мм", Type: domain.ParamFloat, Default: float64(800), Min: pFloat(0), Max: pFloat(3000)},
				{ID: "L", Name: "Длина", Unit: "мм", Type: domain.ParamFloat, Default: float64(10500), Min: pFloat(0), Max: pFloat(20000)},
				{ID: "P_calc", Name: "Расч. давление", Unit: "кгс/см2", Type: domain.ParamFloat, Default: float64(19.5), Min: pFloat(0), Max: pFloat(100)},
				{ID: "T_calc", Name: "Расч. температура", Unit: "°C", Type: domain.ParamFloat, Default: float64(200), Min: pFloat(0), Max: pFloat(500)},
			},
			ModelCode: "heat_exchanger",
		},
		{
			ID: "control_valve", Name: "Регулирующий клапан", Category: domain.CategoryCommon,
			Description: "Cv/Kv, линейная/равнопроцентная характеристика",
			Ports: []domain.Port{
				{ID: "inlet", Name: "Вход", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
				{ID: "outlet", Name: "Выход", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
				{ID: "signal", Name: "Управляющий сигнал", Type: domain.PortSignal, Direction: domain.PortIn, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "Cv", Name: "Пропускная способность", Unit: "м3/ч", Type: domain.ParamFloat, Default: float64(100), Min: pFloat(0), Max: pFloat(1000)},
				{ID: "char_type", Name: "Тип характеристики", Type: domain.ParamSelect, Default: "linear", Options: []string{"linear", "equal_percentage"}},
				{ID: "DN", Name: "Диаметр", Unit: "мм", Type: domain.ParamFloat, Default: float64(150), Min: pFloat(0), Max: pFloat(1000)},
			},
			ModelCode: "control_valve",
		},
		{
			ID: "gate_valve", Name: "Задвижка (запорная)", Category: domain.CategoryCommon,
			Description: "DN, PN, время хода",
			Ports: []domain.Port{
				{ID: "inlet", Name: "Вход", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
				{ID: "outlet", Name: "Выход", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "DN", Name: "Диаметр", Unit: "мм", Type: domain.ParamFloat, Default: float64(200), Min: pFloat(0), Max: pFloat(2000)},
				{ID: "PN", Name: "Давление", Unit: "кгс/см2", Type: domain.ParamFloat, Default: float64(16), Min: pFloat(0), Max: pFloat(320)},
				{ID: "stroke_time", Name: "Время хода", Unit: "с", Type: domain.ParamFloat, Default: float64(10), Min: pFloat(0), Max: pFloat(300)},
			},
			ModelCode: "gate_valve",
		},
		{
			ID: "pid_controller", Name: "ПИД-регулятор", Category: domain.CategoryCommon,
			Description: "Kp/Ki/Kd, пределы, Auto/Manual, коррекция по 2-му параметру",
			Ports: []domain.Port{
				{ID: "pv", Name: "PV (вход сигнала)", Type: domain.PortSignal, Direction: domain.PortIn, Required: true},
				{ID: "out", Name: "OUT (выход сигнала)", Type: domain.PortSignal, Direction: domain.PortOut, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "Kp", Name: "Пропорциональный", Type: domain.ParamFloat, Default: float64(1.2), Min: pFloat(0), Max: pFloat(100)},
				{ID: "Ki", Name: "Интегральный", Type: domain.ParamFloat, Default: float64(0.05), Min: pFloat(0), Max: pFloat(100)},
				{ID: "Kd", Name: "Дифференциальный", Type: domain.ParamFloat, Default: float64(0), Min: pFloat(0), Max: pFloat(100)},
				{ID: "out_min", Name: "Мин. выход", Type: domain.ParamFloat, Default: float64(0)},
				{ID: "out_max", Name: "Макс. выход", Type: domain.ParamFloat, Default: float64(100)},
			},
			ModelCode: "pid_controller",
		},
		{
			ID: "kip_sensor", Name: "КИП-датчик", Category: domain.CategoryCommon,
			Description: "T/P/F/L/U/I, диапазон, погрешность, сигнализации",
			Ports: []domain.Port{
				{ID: "input", Name: "Вход (поток/сигнал)", Type: domain.PortSignal, Direction: domain.PortIn, Required: true},
				{ID: "output", Name: "Выход (сигнал)", Type: domain.PortSignal, Direction: domain.PortOut, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "sensor_type", Name: "Тип датчика", Type: domain.ParamSelect, Default: "T", Options: []string{"T", "P", "F", "L", "U", "I"}},
				{ID: "range_min", Name: "Мин. диапазон", Type: domain.ParamFloat, Default: float64(0)},
				{ID: "range_max", Name: "Макс. диапазон", Type: domain.ParamFloat, Default: float64(100)},
				{ID: "error_pct", Name: "Погрешность", Unit: "%", Type: domain.ParamFloat, Default: float64(0.5), Min: pFloat(0), Max: pFloat(10)},
			},
			ModelCode: "kip_sensor",
		},
		{
			ID: "vessel", Name: "Ёмкость (буферная/дренажная)", Category: domain.CategoryCommon,
			Description: "V, P/T расч., уровнемер осн.+дублёр",
			Ports: []domain.Port{
				{ID: "inlet", Name: "Вход(ы)", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
				{ID: "outlet", Name: "Выход(ы)", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
				{ID: "gas_out", Name: "Газовый выход", Type: domain.PortGas, Direction: domain.PortOut, Required: false},
			},
			Parameters: []domain.Parameter{
				{ID: "V", Name: "Объём", Unit: "м3", Type: domain.ParamFloat, Default: float64(80), Min: pFloat(0), Max: pFloat(10000)},
				{ID: "P_calc", Name: "Расч. давление", Unit: "кгс/см2", Type: domain.ParamFloat, Default: float64(6), Min: pFloat(0), Max: pFloat(100)},
				{ID: "T_calc", Name: "Расч. температура", Unit: "°C", Type: domain.ParamFloat, Default: float64(100), Min: pFloat(0), Max: pFloat(500)},
				{ID: "D", Name: "Диаметр", Unit: "мм", Type: domain.ParamFloat, Default: float64(3000), Min: pFloat(0), Max: pFloat(10000)},
				{ID: "H", Name: "Высота", Unit: "мм", Type: domain.ParamFloat, Default: float64(12000), Min: pFloat(0), Max: pFloat(50000)},
			},
			ModelCode: "vessel",
		},
		{
			ID: "mixer", Name: "Смеситель", Category: domain.CategoryCommon,
			Description: "2+ входа, 1 выход, эффективность смешения",
			Ports: []domain.Port{
				{ID: "in1", Name: "Вход 1", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
				{ID: "in2", Name: "Вход 2", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
				{ID: "outlet", Name: "Выход", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "efficiency", Name: "Эффективность", Unit: "%", Type: domain.ParamFloat, Default: float64(95), Min: pFloat(0), Max: pFloat(100)},
			},
			ModelCode: "mixer",
		},
		{
			ID: "safety_valve", Name: "Предохранительный клапан (ППК)", Category: domain.CategoryCommon,
			Description: "P уставки, DN, сброс на факел",
			Ports: []domain.Port{
				{ID: "inlet", Name: "Вход", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
				{ID: "outlet", Name: "Выход (сброс)", Type: domain.PortGas, Direction: domain.PortOut, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "P_set", Name: "Давление уставки", Unit: "кгс/см2", Type: domain.ParamFloat, Default: float64(6), Min: pFloat(0), Max: pFloat(320)},
				{ID: "DN", Name: "Диаметр", Unit: "мм", Type: domain.ParamFloat, Default: float64(150), Min: pFloat(0), Max: pFloat(500)},
			},
			ModelCode: "safety_valve",
		},
		{
			ID: "source", Name: "Источник (граничное условие)", Category: domain.CategoryCommon,
			Description: "Вход сырья/воды/пара — T, P, F, состав",
			Ports: []domain.Port{
				{ID: "outlet", Name: "Выход", Type: domain.PortLiquid, Direction: domain.PortOut, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "T", Name: "Температура", Unit: "°C", Type: domain.ParamFloat, Default: float64(20), Min: pFloat(-50), Max: pFloat(500)},
				{ID: "P", Name: "Давление", Unit: "кгс/см2", Type: domain.ParamFloat, Default: float64(1), Min: pFloat(0), Max: pFloat(320)},
				{ID: "F", Name: "Расход", Unit: "м3/ч", Type: domain.ParamFloat, Default: float64(450), Min: pFloat(0), Max: pFloat(5000)},
			},
			ModelCode: "source",
		},
		{
			ID: "sink", Name: "Сток (граничное условие)", Category: domain.CategoryCommon,
			Description: "Выход продуктов/канализация/факел",
			Ports: []domain.Port{
				{ID: "inlet", Name: "Вход", Type: domain.PortLiquid, Direction: domain.PortIn, Required: true},
			},
			Parameters: []domain.Parameter{
				{ID: "P_out", Name: "Давление выхода", Unit: "кгс/см2", Type: domain.ParamFloat, Default: float64(1), Min: pFloat(0), Max: pFloat(50)},
				{ID: "type", Name: "Тип стока", Type: domain.ParamSelect, Default: "product", Options: []string{"product", "flare", "sewer"}},
			},
			ModelCode: "sink",
		},
	}
}

func pFloat(v float64) *float64 { return &v }
