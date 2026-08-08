export interface ScenarioFault {
  id: string
  tag: string
  type: 'sensor_fail' | 'valve_stuck' | 'pump_trip' | 'leak' | 'fouling' | 'controller_fail'
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  triggerDelay?: number
  triggerCondition?: string
}

export interface ReferenceAction {
  time: number
  description: string
  tag?: string
  value?: number
  isCritical?: boolean
}

export interface Scenario {
  id: string
  name: string
  description: string
  difficulty: 1 | 2 | 3 | 4 | 5
  duration: number
  faults: ScenarioFault[]
  referenceActions: ReferenceAction[]
  passingScore: number
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'sc-normal-startup',
    name: 'Нормальный пуск установки',
    description:
      'Плановый пуск ЭЛОУ-АВТ с нуля. Проверка соблюдения регламента разогрева и вывода на режим.',
    difficulty: 2,
    duration: 3600,
    faults: [],
    referenceActions: [
      { time: 0, description: 'Открыть подачу сырой нефти FV-101', tag: 'FV-101', value: 30 },
      { time: 300, description: 'Включить насосы нефти Н-101А/Б', tag: 'H-101A', value: 1 },
      {
        time: 600,
        description: 'Запустить разогрев печи П-1, установить температуру 180°C',
        tag: 'TRC-201',
        value: 180,
      },
      {
        time: 1200,
        description: 'Повысить температуру печи до 280°C',
        tag: 'TRC-201',
        value: 280,
        isCritical: true,
      },
      {
        time: 1800,
        description: 'Вывести уровень в рефлюксной ёмкости 50%',
        tag: 'LRC-301',
        value: 50,
      },
      { time: 2400, description: 'Включить орошение колонны К-2', tag: 'FRC-301', value: 80 },
      {
        time: 3000,
        description: 'Выйти на рабочий режим, температура верха К-2 120°C',
        tag: 'TI-302',
        value: 120,
        isCritical: true,
      },
    ],
    passingScore: 70,
  },
  {
    id: 'sc-pump-trip',
    name: 'Останов насоса нефти',
    description:
      'Внезапный аварийный останов насоса Н-101А. Переключение на резервный насос Н-101Б.',
    difficulty: 2,
    duration: 900,
    faults: [
      {
        id: 'f-pump-trip',
        tag: 'H-101A',
        type: 'pump_trip',
        description: 'Аварийный останов насоса Н-101А',
        severity: 'high',
        triggerDelay: 120,
      },
    ],
    referenceActions: [
      {
        time: 120,
        description: 'Обнаружить сигнализацию об останове насоса Н-101А',
        isCritical: true,
      },
      {
        time: 150,
        description: 'Включить резервный насос Н-101Б',
        tag: 'H-101B',
        value: 1,
        isCritical: true,
      },
      {
        time: 200,
        description: 'Убедиться в нормальном давлении на выкиде Н-101Б',
        tag: 'PI-102',
        value: 2.5,
      },
      { time: 300, description: 'Принять меры по устранению неисправности Н-101А' },
    ],
    passingScore: 75,
  },
  {
    id: 'sc-level-loss',
    name: 'Потеря уровня в рефлюксной ёмкости',
    description:
      'Нарушение регулирования уровня в рефлюксной ёмкости Е-301. Риск нарушения орошения колонны.',
    difficulty: 3,
    duration: 1800,
    faults: [
      {
        id: 'f-lcv-stuck',
        tag: 'LCV-301',
        type: 'valve_stuck',
        description: 'Заклинивание клапана уровня LCV-301 в положении "открыт"',
        severity: 'medium',
        triggerDelay: 300,
      },
    ],
    referenceActions: [
      { time: 300, description: 'Обнаружить понижение уровня в Е-301 ниже 30%', isCritical: true },
      {
        time: 360,
        description: 'Перевести регулятор LRC-301 в ручной режим',
        tag: 'LRC-301',
        value: 0,
      },
      {
        time: 420,
        description: 'Прикрыть клапан LCV-301 вручную до 40%',
        tag: 'LCV-301',
        value: 40,
        isCritical: true,
      },
      { time: 600, description: 'Восстановить уровень в Е-301 до 50%', tag: 'LI-301', value: 50 },
      { time: 900, description: 'Убедиться в стабильном орошении К-2' },
    ],
    passingScore: 70,
  },
  {
    id: 'sc-temp-runaway',
    name: 'Неконтролируемый рост температуры низа К-2',
    description:
      'Отказ регулятора температуры низа атмосферной колонны. Риск перегрева и аварийного останова.',
    difficulty: 4,
    duration: 1200,
    faults: [
      {
        id: 'f-tc-fail',
        tag: 'TRC-201',
        type: 'controller_fail',
        description: 'Отказ регулятора температуры печи TRC-201',
        severity: 'critical',
        triggerDelay: 180,
      },
    ],
    referenceActions: [
      {
        time: 180,
        description: 'Обнаружить сигнализацию HH по температуре низа К-2',
        isCritical: true,
      },
      {
        time: 210,
        description: 'Перевести TRC-201 в ручной режим',
        tag: 'TRC-201',
        value: 0,
        isCritical: true,
      },
      {
        time: 240,
        description: 'Закрыть клапан подачи топлива в печь FV-201 до 20%',
        tag: 'FV-201',
        value: 20,
      },
      {
        time: 360,
        description: 'Стабилизировать температуру низа К-2 в диапазоне 345-355°C',
        tag: 'TI-210',
        value: 350,
        isCritical: true,
      },
      { time: 600, description: 'Организовать ремонт регулятора TRC-201' },
    ],
    passingScore: 80,
  },
  {
    id: 'sc-esd-test',
    name: 'Аварийный останов по ПАЗ',
    description:
      'Срабатывание системы ПАЗ при достижении критических параметров. Правильная последовательность аварийного останова.',
    difficulty: 3,
    duration: 1800,
    faults: [
      {
        id: 'f-leak',
        tag: 'P-101-LINE',
        type: 'leak',
        description: 'Разгерметизация трубопровода высокого давления',
        severity: 'critical',
        triggerDelay: 60,
      },
    ],
    referenceActions: [
      { time: 60, description: 'Обнаружить аварийный сигнал о разгерметизации', isCritical: true },
      {
        time: 90,
        description: 'Нажать кнопку аварийного останова ESD',
        tag: 'ESD',
        value: 1,
        isCritical: true,
      },
      { time: 120, description: 'Убедиться в закрытии всех ПАЗ-клапанов', isCritical: true },
      {
        time: 180,
        description: 'Перекрыть подачу нефти на установку FV-101',
        tag: 'FV-101',
        value: 0,
      },
      { time: 300, description: 'Остановить все насосы', isCritical: true },
      { time: 600, description: 'Вести наблюдение за давлением и температурой при освобождении' },
      { time: 900, description: 'Доложить о завершении аварийного останова' },
    ],
    passingScore: 85,
  },
  {
    id: 'sc-fouling',
    name: 'Загрязнение теплообменников',
    description:
      'Постепенное ухудшение теплообмена из-за загрязнения теплообменников типа Э-102. Оптимизация режима.',
    difficulty: 3,
    duration: 3600,
    faults: [
      {
        id: 'f-fouling',
        tag: 'E-102',
        type: 'fouling',
        description: 'Загрязнение теплообменников нефть-нефть Э-102 A/B',
        severity: 'medium',
        triggerDelay: 600,
      },
    ],
    referenceActions: [
      { time: 600, description: 'Обнаружить рост температуры нефти после теплообменников' },
      {
        time: 900,
        description: 'Увеличить расход нефти через байпас теплообменников',
        tag: 'HV-102',
        value: 30,
      },
      {
        time: 1200,
        description: 'Скорректировать температуру входа в печь для поддержания режима',
        tag: 'TRC-201',
        value: 370,
      },
      { time: 1800, description: 'Оформить заявку на очистку теплообменников Э-102' },
      {
        time: 2400,
        description: 'Вывести рабочую нитку теплообменников на очистку в паровой резерв',
      },
    ],
    passingScore: 65,
  },
]
