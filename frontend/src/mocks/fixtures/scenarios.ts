// Re-export shared types from @/types.
// ScenarioStatus is mock-only (backend doesn't have a status/moderation concept).
import type { ScenarioCriteria, Scenario, FaultCatalogItem } from '@/types'
export type {
  FaultTrigger,
  ScenarioFaultEntry,
  ReferenceActionExpected,
  ReferenceActionEntry,
  ScenarioCriteria,
  ScenarioType,
  Scenario,
  FaultCatalogItem,
} from '@/types'

/** Mock-only moderation lifecycle. Not present in real API responses. */
export type ScenarioStatus = 'draft' | 'published' | 'archived'

// ─── Fault catalog fixtures ──────────────────────────────────────────────────

export const FAULT_CATALOG: FaultCatalogItem[] = [
  {
    fault_id: 'flt-pump-trip',
    name: 'Аварийный останов насоса',
    applicable_component_types: ['pump', 'compressor'],
    affected_tags: ['FI-101', 'PI-101'],
    description: 'Внезапный электрический или механический отказ насоса',
    severity: 'high',
    damage_per_sec: 0.5,
  },
  {
    fault_id: 'flt-valve-stuck',
    name: 'Заклинивание регулирующего клапана',
    applicable_component_types: ['valve'],
    affected_tags: ['FV-101', 'FV-201', 'FV-301'],
    description: 'Клапан застрял в текущем положении',
    severity: 'medium',
    damage_per_sec: 0.2,
  },
  {
    fault_id: 'flt-sensor-fail',
    name: 'Отказ датчика',
    applicable_component_types: ['sensor'],
    affected_tags: ['TI-201', 'PI-101', 'LI-301'],
    description: 'Датчик перестаёт передавать достоверные показания',
    severity: 'medium',
    damage_per_sec: 0.1,
  },
  {
    fault_id: 'flt-temp-runaway',
    name: 'Перегрев теплообменника',
    applicable_component_types: ['heatexchanger'],
    affected_tags: ['TI-201', 'TI-202'],
    description: 'Прогрессирующий рост температуры выше допустимого',
    severity: 'critical',
    damage_per_sec: 1.5,
  },
  {
    fault_id: 'flt-level-high',
    name: 'Переполнение ёмкости',
    applicable_component_types: ['vessel', 'separator'],
    affected_tags: ['LI-301', 'LI-302'],
    description: 'Уровень в ёмкости превышает критическую отметку',
    severity: 'high',
    damage_per_sec: 0.8,
  },
  {
    fault_id: 'flt-controller-fail',
    name: 'Отказ регулятора',
    applicable_component_types: ['controller'],
    affected_tags: ['TRC-201', 'LRC-301', 'FRC-301'],
    description: 'Регулятор перестаёт выдавать управляющее воздействие',
    severity: 'medium',
    damage_per_sec: 0.3,
  },
  {
    fault_id: 'flt-fouling',
    name: 'Загрязнение трубного пространства',
    applicable_component_types: ['heatexchanger', 'column'],
    affected_tags: ['TI-201', 'PI-201'],
    description: 'Постепенное ухудшение теплообмена из-за отложений',
    severity: 'low',
    damage_per_sec: 0.05,
  },
  {
    fault_id: 'flt-column-flood',
    name: 'Захлёбывание ректификационной колонны',
    applicable_component_types: ['column'],
    affected_tags: ['FI-301', 'TI-302', 'PI-301'],
    description: 'Превышение предельно допустимой нагрузки по жидкости',
    severity: 'critical',
    damage_per_sec: 2.0,
  },
]

// ─── Scenario fixtures ────────────────────────────────────────────────────────

const CRITERIA_DEFAULT: ScenarioCriteria = {
  max_score: 100,
  penalty_late: 0.5,
  penalty_miss: 10,
  penalty_forbidden: 5,
  critical_actions: [],
  pass_threshold: 60,
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'sc-normal-startup',
    name: 'Нормальный пуск установки ЭЛОУ-АВТ',
    description:
      'Плановый пуск ЭЛОУ-АВТ с нуля. Проверка соблюдения регламента разогрева и вывода на режим.',
    template_id: 'tmpl-elou-avt',
    type: 'training',
    author_id: 'user-instructor',
    status: 'published',
    start_preset_id: 'preset-cold',
    faults: [],
    reference_actions: [
      {
        step: 1,
        description: 'Открыть подачу сырой нефти FV-101 на 30%',
        expected: { target: 'FV-101', action: 'set', value: 30 },
        deadline_seconds: 120,
        mandatory: true,
      },
      {
        step: 2,
        description: 'Включить насосы нефти Н-101А/Б',
        expected: { target: 'H-101A', action: 'start' },
        deadline_seconds: 180,
        mandatory: true,
      },
      {
        step: 3,
        description: 'Запустить разогрев печи П-1, установить температуру 180°C',
        expected: { target: 'TRC-201', action: 'set', value: 180 },
        deadline_seconds: 300,
        mandatory: false,
      },
      {
        step: 4,
        description: 'Повысить температуру печи до 280°C',
        expected: { target: 'TRC-201', action: 'set', value: 280 },
        deadline_seconds: 600,
        mandatory: true,
      },
      {
        step: 5,
        description: 'Вывести уровень в рефлюксной ёмкости 50%',
        expected: { target: 'LRC-301', action: 'set', value: 50 },
        deadline_seconds: 900,
        mandatory: false,
      },
    ],
    criteria: {
      ...CRITERIA_DEFAULT,
      critical_actions: ['2', '4'],
      pass_threshold: 70,
    },
    created_at: '2025-11-01T10:00:00Z',
    updated_at: '2025-12-01T14:30:00Z',
  },
  {
    id: 'sc-pump-trip',
    name: 'Останов насоса нефти',
    description:
      'Внезапный аварийный останов насоса Н-101А. Переключение на резервный насос Н-101Б.',
    template_id: 'tmpl-elou-avt',
    type: 'training',
    author_id: 'user-instructor',
    status: 'published',
    faults: [
      {
        id: 'sf-001',
        fault_id: 'flt-pump-trip',
        component_instance_id: 'H-101A',
        params: { severity_pct: 100, ramp_seconds: 0 },
        trigger: { type: 'time', at_model_time: 120 },
        hidden: false,
      },
    ],
    reference_actions: [
      {
        step: 1,
        description: 'Подтвердить сигнализацию останова Н-101А',
        expected: { target: 'ALARM-H101A', action: 'acknowledge' },
        deadline_seconds: 30,
        mandatory: false,
      },
      {
        step: 2,
        description: 'Включить резервный насос Н-101Б',
        expected: { target: 'H-101B', action: 'start' },
        deadline_seconds: 60,
        mandatory: true,
      },
      {
        step: 3,
        description: 'Проверить давление после переключения PI-101',
        expected: { target: 'PI-101', action: 'check' },
        deadline_seconds: 90,
        mandatory: false,
      },
    ],
    criteria: {
      ...CRITERIA_DEFAULT,
      critical_actions: ['2'],
      pass_threshold: 60,
    },
    created_at: '2025-11-05T09:00:00Z',
    updated_at: '2025-12-02T11:00:00Z',
  },
  {
    id: 'sc-temp-runaway',
    name: 'Перегрев теплообменника Т-101',
    description: 'Прогрессирующий рост температуры в теплообменнике Т-101. Защитные меры.',
    template_id: 'tmpl-elou-avt',
    type: 'exam',
    author_id: 'user-instructor',
    status: 'published',
    faults: [
      {
        id: 'sf-002',
        fault_id: 'flt-temp-runaway',
        component_instance_id: 'T-101',
        params: { severity_pct: 80, ramp_seconds: 300 },
        trigger: { type: 'time', at_model_time: 60 },
        hidden: true,
      },
    ],
    reference_actions: [
      {
        step: 1,
        description: 'Снизить расход горячей стороны Т-101',
        expected: { target: 'FV-201', action: 'set', value: 20 },
        deadline_seconds: 120,
        mandatory: true,
      },
      {
        step: 2,
        description: 'Уведомить диспетчера о превышении температуры',
        expected: { target: 'DISPATCH', action: 'notify' },
        deadline_seconds: 180,
        mandatory: false,
      },
    ],
    criteria: {
      ...CRITERIA_DEFAULT,
      max_score: 150,
      critical_actions: ['1'],
      pass_threshold: 65,
    },
    created_at: '2025-11-10T14:00:00Z',
    updated_at: '2025-12-05T16:00:00Z',
  },
  {
    id: 'sc-column-flood',
    name: 'Захлёбывание колонны К-2',
    description: 'Нагрузка по жидкости превышает допустимую. Экзаменационный режим.',
    template_id: 'tmpl-atm-column',
    type: 'exam',
    author_id: 'user-instructor',
    status: 'draft',
    faults: [
      {
        id: 'sf-003',
        fault_id: 'flt-column-flood',
        component_instance_id: 'K-2',
        params: { severity_pct: 60, ramp_seconds: 180 },
        trigger: {
          type: 'condition',
          condition: { tag: 'FI-301', op: '>', value: 95, for_seconds: 30 },
        },
        hidden: false,
      },
    ],
    reference_actions: [
      {
        step: 1,
        description: 'Снизить подачу в колонну FRC-301 до 60%',
        expected: { target: 'FRC-301', action: 'set', value: 60 },
        deadline_seconds: 90,
        mandatory: true,
      },
    ],
    criteria: {
      ...CRITERIA_DEFAULT,
      critical_actions: ['1'],
      pass_threshold: 70,
    },
    created_at: '2025-12-01T08:00:00Z',
    updated_at: '2025-12-06T09:00:00Z',
  },
  {
    id: 'sc-gdm-sensor-fail',
    name: 'Отказ датчиков ГДМ',
    description: 'Множественный отказ датчиков давления в секции ГДМ. Действия оператора.',
    template_id: 'tmpl-gdm',
    type: 'training',
    author_id: 'user-instructor',
    status: 'archived',
    faults: [
      {
        id: 'sf-004',
        fault_id: 'flt-sensor-fail',
        component_instance_id: 'PI-401',
        params: { severity_pct: 100, ramp_seconds: 0 },
        trigger: { type: 'time', at_model_time: 300 },
        hidden: false,
      },
    ],
    reference_actions: [],
    criteria: CRITERIA_DEFAULT,
    created_at: '2025-10-01T08:00:00Z',
    updated_at: '2025-10-15T12:00:00Z',
  },
]
