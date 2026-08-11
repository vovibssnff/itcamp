/**
 * Shared domain types used across the SPA.
 *
 * These types match the gw API contracts. Mock fixtures in src/mocks/fixtures/
 * re-export them so MSW handlers and unit tests stay compatible.
 */

// ─── Components ──────────────────────────────────────────────────────────────

export interface ComponentPort {
  id: string
  name: string
  type: 'liquid' | 'gas' | 'steam' | 'signal' | 'electric'
  direction: 'in' | 'out'
}

export interface ComponentParameter {
  id: string
  name: string
  label: string
  type: 'number' | 'string' | 'boolean' | 'enum'
  unit?: string
  defaultValue?: unknown
  options?: string[]
  min?: number
  max?: number
  required?: boolean
}

export interface ComponentType {
  id: string
  name: string
  /** SPA display category (elou/atm/gdm/common) or raw API category string. */
  category: string
  description: string
  shape:
    | 'pump'
    | 'column'
    | 'vessel'
    | 'heatexchanger'
    | 'valve'
    | 'sensor'
    | 'controller'
    | 'separator'
    | 'compressor'
    | 'furnace'
  ports: ComponentPort[]
  parameters: ComponentParameter[]
}

// ─── Templates ───────────────────────────────────────────────────────────────

import type { CanvasNode, CanvasEdge } from '@/store/constructor'

export interface Template {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  isValid: boolean
}

// ─── Sessions ────────────────────────────────────────────────────────────────

import type { SessionStatus } from '@/store/session'

export interface SessionRecord {
  id: string
  templateId: string
  templateName: string
  operatorId: string
  operatorIds?: string[]
  operatorName: string
  instructorId: string
  scenarioId?: string
  scenarioName?: string
  mode: 'training' | 'exam'
  status: SessionStatus
  startedAt: string | null
  finishedAt: string | null
  speed: number
  reportId?: string
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

export interface FaultTrigger {
  type: 'time' | 'condition'
  at_model_time?: number
  condition?: {
    tag: string
    op: '>' | '<' | '>=' | '<=' | '==' | '!='
    value: number
    for_seconds: number
  }
}

export interface ScenarioFaultEntry {
  id: string
  fault_id: string
  component_instance_id: string
  params: {
    severity_pct: number
    ramp_seconds: number
  }
  trigger: FaultTrigger
  hidden: boolean
}

export interface ReferenceActionExpected {
  target: string
  action: string
  value?: number
}

export interface ReferenceActionEntry {
  step: number
  description: string
  expected: ReferenceActionExpected
  deadline_seconds: number
  mandatory: boolean
}

export interface ScenarioCriteria {
  max_score: number
  penalty_late: number
  penalty_miss: number
  penalty_forbidden: number
  critical_actions: string[]
  pass_threshold: number
}

export type ScenarioType = 'training' | 'exam'

export interface Scenario {
  id: string
  name: string
  description: string
  template_id: string
  type: ScenarioType
  start_preset_id?: string
  author_id: string
  faults: ScenarioFaultEntry[]
  reference_actions: ReferenceActionEntry[]
  criteria: ScenarioCriteria
  created_at: string
  updated_at: string
  /** Mock-only moderation status — not returned by the real API. */
  status?: 'draft' | 'published' | 'archived'
}

// ─── Faults ──────────────────────────────────────────────────────────────────

export interface FaultCatalogItem {
  fault_id: string
  name: string
  applicable_component_types: string[]
  affected_tags: string[]
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  damage_per_sec: number
}
