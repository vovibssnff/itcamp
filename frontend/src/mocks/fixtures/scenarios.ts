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
// Aligned with services/go/scenario/seeds/faults.go (FLT-* + sim space-form tags).

export const FAULT_CATALOG: FaultCatalogItem[] = [
  {
    fault_id: 'FLT-ELOU-INTERFACE-LOW',
    name: 'Падение уровня раздела фаз в электродегидраторе',
    applicable_component_types: ['electro_dehydrator', 'vessel', 'ct-desalter'],
    affected_tags: ['LRCA 639', 'LRCA 640', 'LRCA 641', 'LRCA 642', 'LRCA 643', 'LRCA 644'],
    description: 'Снижение уровня ниже 3500 мм → блокировка HV',
    severity: 'high',
    damage_per_sec: 0.5,
  },
  {
    fault_id: 'FLT-ELOU-PRESSURE-HIGH',
    name: 'Рост давления в электродегидраторах / Е-15',
    applicable_component_types: ['electro_dehydrator', 'vessel', 'ct-desalter'],
    affected_tags: ['PRA 351', 'PRA 312', 'PRC 313'],
    description: 'Рост давления выше расчётного (Е-15: 5,3 кгс/см², Э: 16 кгс/см²)',
    severity: 'high',
    damage_per_sec: 0.3,
  },
  {
    fault_id: 'FLT-FEED-FLOW-LOW',
    name: 'Падение расхода сырой нефти',
    applicable_component_types: ['centrifugal_pump', 'furnace', 'pump', 'ct-pump'],
    affected_tags: ['FI 101', 'FRC 404', 'FRC 405', 'FRC 406', 'FYQR 117'],
    description: 'Снижение суммарного расхода нефти при работающих печах',
    severity: 'critical',
    damage_per_sec: 1.0,
  },
  {
    fault_id: 'FLT-P3-COT-HIGH',
    name: 'Рост температуры на выходе змеевика печи (COT)',
    applicable_component_types: ['furnace', 'heatexchanger', 'ct-pipe-furnace', 'ct-heatexchanger'],
    affected_tags: ['TI 103', 'TR 55-9', 'TR 55-10', 'TR 55-11', 'TRC 3', 'TRC 5'],
    description: 'Рост COT выше 340°C (П-3)',
    severity: 'high',
    damage_per_sec: 0.8,
  },
  {
    fault_id: 'FLT-K1-PRESSURE-HIGH',
    name: 'Рост давления верха колонны К-1',
    applicable_component_types: ['distillation_column', 'column', 'ct-atm-column'],
    affected_tags: ['PI 102', 'PRSA 204', 'TRC 2', 'FRC 408', 'PRC 221'],
    description: 'Рост давления до блокировки ПАЗ (4,8 кгс/см²)',
    severity: 'critical',
    damage_per_sec: 1.5,
  },
  {
    fault_id: 'FLT-K1-LEVEL-LOW',
    name: 'Падение уровня жидкости в кубе К-1',
    applicable_component_types: ['distillation_column', 'column', 'ct-atm-column'],
    affected_tags: ['LI 101', 'LRCA 602', 'FRCA 411', 'FRCA 412', 'FRC 458'],
    description: 'Падение уровня ниже допустимого → риск сухого хода насосов',
    severity: 'high',
    damage_per_sec: 0.7,
  },
  {
    fault_id: 'FLT-K2-VACUUM-LOSS',
    name: 'Потеря вакуума в колонне К-2',
    applicable_component_types: ['distillation_column', 'column', 'ct-atm-column'],
    affected_tags: ['PI 103', 'PRSA 213', 'FRC 418', 'FRC 421', 'TRC 50'],
    description: 'Рост давления до 1,0 кгс/см² → блокировка ПАЗ при 1,5',
    severity: 'critical',
    damage_per_sec: 1.2,
  },
  {
    fault_id: 'FLT-K31-LEVEL-LOW',
    name: 'Падение уровня в стриппинге К-3/1',
    applicable_component_types: ['stripping_column', 'column', 'vessel'],
    affected_tags: ['LRCA 606', 'FRC 422', 'TR 17-33'],
    description: 'Падение уровня ниже 15% → останов насосов Н-14/Н-67А',
    severity: 'high',
    damage_per_sec: 0.6,
  },
  {
    fault_id: 'FLT-K4-PRESSURE-HIGH',
    name: 'Рост давления в колонне стабилизации К-4',
    applicable_component_types: ['stabilization_column', 'column'],
    affected_tags: ['PRCA 220', 'PRCA 223', 'TRC 5', 'FR 415'],
    description: 'Рост давления выше рабочего диапазона 6–11 кгс/см²',
    severity: 'high',
    damage_per_sec: 0.5,
  },
  {
    fault_id: 'FLT-IA-PRESSURE-LOW',
    name: 'Падение давления воздуха КИП',
    applicable_component_types: ['kip_sensor', 'control_valve', 'gate_valve', 'sensor', 'valve'],
    affected_tags: ['PRA 700', 'PI 101'],
    description: 'Падение давления воздуха КИП → отказ регуляторов',
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
        description: 'Открыть подачу сырой нефти FV 101 на 30%',
        expected: { target: 'FV 101', action: 'set', value: 30 },
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
        expected: { target: 'TRC 201', action: 'set', value: 180 },
        deadline_seconds: 300,
        mandatory: false,
      },
      {
        step: 4,
        description: 'Повысить температуру печи до 280°C',
        expected: { target: 'TRC 201', action: 'set', value: 280 },
        deadline_seconds: 600,
        mandatory: true,
      },
      {
        step: 5,
        description: 'Вывести уровень в рефлюксной ёмкости 50%',
        expected: { target: 'LRC 301', action: 'set', value: 50 },
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
        fault_id: 'FLT-FEED-FLOW-LOW',
        component_instance_id: 'n-pump1',
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
        description: 'Проверить давление после переключения PI 101',
        expected: { target: 'PI 101', action: 'check' },
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
        fault_id: 'FLT-P3-COT-HIGH',
        component_instance_id: 'n-furnace',
        params: { severity_pct: 80, ramp_seconds: 300 },
        trigger: { type: 'time', at_model_time: 60 },
        hidden: true,
      },
    ],
    reference_actions: [
      {
        step: 1,
        description: 'Снизить расход горячей стороны Т-101',
        expected: { target: 'FV 201', action: 'set', value: 20 },
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
        fault_id: 'FLT-K2-VACUUM-LOSS',
        component_instance_id: 'n-column',
        params: { severity_pct: 60, ramp_seconds: 180 },
        trigger: {
          type: 'condition',
          condition: { tag: 'FI 301', op: '>', value: 95, for_seconds: 30 },
        },
        hidden: false,
      },
    ],
    reference_actions: [
      {
        step: 1,
        description: 'Снизить подачу в колонну FRC 301 до 60%',
        expected: { target: 'FRC 301', action: 'set', value: 60 },
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
        fault_id: 'FLT-IA-PRESSURE-LOW',
        component_instance_id: 'PI 401',
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
