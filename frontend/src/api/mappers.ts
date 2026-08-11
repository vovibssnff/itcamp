import type { UserProfile, UserRole } from '@/store/auth'
import type { CanvasEdge, CanvasNode } from '@/store/constructor'
import type { Template, SessionRecord, ComponentType } from '@/types'

const ROLES: UserRole[] = ['admin', 'instructor', 'operator']

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback
}

function pick(raw: Record<string, unknown>, snake: string, camel: string): unknown {
  return raw[snake] ?? raw[camel]
}

export interface BackendUser {
  id?: string
  login?: string
  full_name?: string
  roles?: string[]
  status?: string
  mfa_enabled?: boolean
}

export function mapUser(raw: unknown): UserProfile {
  const u = asRecord(raw) as BackendUser & Record<string, unknown>
  const roles = Array.isArray(u.roles) ? u.roles.map(String) : []
  // Prefer privileged roles when several are present (admin > instructor > operator).
  const primary =
    ROLES.find((r) => roles.includes(r)) ??
    (ROLES.includes(str(u.role) as UserRole) ? (str(u.role) as UserRole) : null)

  return {
    id: str(u.id),
    username: str(u.login ?? u.username),
    displayName: str(u.full_name ?? u.displayName ?? u.login ?? u.username),
    // Typed fallback only — prefer `roles` / JWT when present; do not treat as real RBAC.
    role: primary ?? 'operator',
    roles: ROLES.filter((r) => roles.includes(r)),
  }
}

function padBase64(s: string): string {
  const pad = (4 - (s.length % 4)) % 4
  return s + '='.repeat(pad)
}

/** Decode roles claim from a JWT access token (payload only; no signature check). */
export function rolesFromAccessToken(token: string | null | undefined): UserRole[] {
  if (!token) return []
  const parts = token.split('.')
  if (parts.length < 2 || !parts[1]) return []
  try {
    const json = atob(padBase64(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    const payload = JSON.parse(json) as { roles?: unknown }
    const roles = Array.isArray(payload.roles) ? payload.roles.map(String) : []
    return ROLES.filter((r) => roles.includes(r))
  } catch {
    return []
  }
}

export function pickPrimaryRole(roles: UserRole[], fallback: UserRole = 'operator'): UserRole {
  return ROLES.find((r) => roles.includes(r)) ?? fallback
}

export function toCreateUserBody(profile: {
  username: string
  displayName: string
  role: UserRole
}): { login: string; full_name: string; roles: string[] } {
  return {
    login: profile.username,
    full_name: profile.displayName,
    roles: [profile.role],
  }
}

const EDGE_MEDIA = new Set(['liquid', 'gas', 'steam', 'electric', 'signal'])

function mapEdgeMediaType(raw: unknown): CanvasEdge['type'] | undefined {
  const t = String(raw ?? '').toLowerCase()
  if (EDGE_MEDIA.has(t)) return t as CanvasEdge['type']
  return undefined
}

function mapGraph(raw: unknown): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const r = asRecord(raw)
  const graph = asRecord(r.graph)
  const layout = asRecord(graph.layout)
  const mnemo = asRecord(layout.mnemo_positions)

  // Backend shape: { component_type_id, position: {x,y}, parameters, label }
  // Frontend shape: { typeId, x, y, parameters, label }
  const rawNodes = (graph.nodes ?? r.nodes ?? []) as unknown[]
  const nodes: CanvasNode[] = rawNodes.map((n) => {
    const rn = asRecord(n)
    const pos = asRecord(rn.position)
    const id = str(rn.id)
    const mnemoPos = asRecord(mnemo[id])
    const params = (rn.parameters as Record<string, unknown>) ?? {}
    // tags may live on the node or inside parameters.tags
    const tagsFromParams = Array.isArray(params.tags) ? (params.tags as string[]) : undefined
    const tags = Array.isArray(rn.tags) ? (rn.tags as string[]) : tagsFromParams
    const width = typeof rn.width === 'number' ? rn.width : num(params.width, NaN)
    const height = typeof rn.height === 'number' ? rn.height : num(params.height, NaN)
    return {
      id,
      typeId: str(rn.component_type_id ?? rn.typeId ?? rn.type_id),
      x: num(rn.x ?? pos.x ?? mnemoPos.x),
      y: num(rn.y ?? pos.y ?? mnemoPos.y),
      label: str(rn.label),
      parameters: params,
      tags,
      ...(Number.isFinite(width) ? { width } : {}),
      ...(Number.isFinite(height) ? { height } : {}),
    }
  })

  // Backend shape: { from: {node_id, port}, to: {node_id, port}, type }
  // Frontend shape: { sourceNodeId, sourcePortId, targetNodeId, targetPortId, type }
  const rawEdges = (graph.edges ?? r.edges ?? []) as unknown[]
  const edges: CanvasEdge[] = rawEdges.map((e) => {
    const re = asRecord(e)
    const from = asRecord(re.from)
    const to = asRecord(re.to)
    const type = mapEdgeMediaType(re.type)
    return {
      id: str(re.id),
      sourceNodeId: str(from.node_id ?? re.sourceNodeId),
      sourcePortId: str(from.port ?? re.sourcePortId),
      targetNodeId: str(to.node_id ?? re.targetNodeId),
      targetPortId: str(to.port ?? re.targetPortId),
      ...(type ? { type } : {}),
    }
  })

  return { nodes, edges }
}

export function mapTemplate(raw: unknown): Template {
  const r = asRecord(raw)
  const { nodes, edges } = mapGraph(r)
  const status = str(pick(r, 'status', 'status'))
  const isValid =
    typeof r.isValid === 'boolean' ? r.isValid : status === 'published' || nodes.length > 0

  return {
    id: str(r.id),
    name: str(r.name),
    description: str(r.description),
    createdAt: str(pick(r, 'created_at', 'createdAt')),
    updatedAt: str(pick(r, 'updated_at', 'updatedAt')),
    nodes,
    edges,
    isValid,
  }
}

/** Resolve edge media for save — prefer stored type, else derive from source port. */
export function resolveEdgeTypeForSave(
  edge: CanvasEdge,
  nodes: CanvasNode[],
  componentTypes?: Array<{ id: string; ports: Array<{ id: string; type: string }> }>,
): string {
  if (edge.type && EDGE_MEDIA.has(edge.type)) return edge.type
  if (!componentTypes) return 'liquid'
  const srcNode = nodes.find((n) => n.id === edge.sourceNodeId)
  if (!srcNode) return 'liquid'
  const ct = componentTypes.find((c) => c.id === srcNode.typeId)
  const port = ct?.ports.find((p) => p.id === edge.sourcePortId)
  const t = String(port?.type ?? 'liquid').toLowerCase()
  return EDGE_MEDIA.has(t) ? t : 'liquid'
}

export function toTemplateBody(
  template: Partial<Template> & { name: string },
  componentTypes?: Array<{ id: string; ports: Array<{ id: string; type: string }> }>,
) {
  const nodes = template.nodes ?? []
  const edges = template.edges ?? []
  const mnemo_positions: Record<string, { x: number; y: number }> = {}
  for (const n of nodes) {
    mnemo_positions[n.id] = { x: n.x, y: n.y }
  }

  return {
    name: template.name,
    description: template.description ?? '',
    graph: {
      schema_version: '2.0',
      nodes: nodes.map((n) => {
        const parameters: Record<string, unknown> = { ...(n.parameters ?? {}) }
        if (n.tags?.length) parameters.tags = n.tags
        if (n.width != null) parameters.width = n.width
        if (n.height != null) parameters.height = n.height
        return {
          id: n.id,
          component_type_id: n.typeId,
          label: n.label ?? '',
          position: { x: n.x, y: n.y },
          parameters,
          ports: {},
          ...(n.tags?.length ? { tags: n.tags } : {}),
        }
      }),
      edges: edges.map((e) => ({
        id: e.id,
        type: resolveEdgeTypeForSave(e, nodes, componentTypes),
        from: { node_id: e.sourceNodeId, port: e.sourcePortId },
        to: { node_id: e.targetNodeId, port: e.targetPortId },
      })),
      layout: { mnemo_positions, custom_labels: {} },
    },
  }
}

export type TemplateSummary = Omit<Template, 'nodes' | 'edges'>

export function mapTemplateSummary(raw: unknown): TemplateSummary {
  const t = mapTemplate(raw)
  const { nodes: _n, edges: _e, ...summary } = t
  return summary
}

const CATEGORY_FROM_API: Record<string, string> = {
  ЭЛОУ: 'elou',
  Атмосфера: 'atm',
  ГДМ: 'gdm',
  Общие: 'common',
  elou: 'elou',
  atm: 'atm',
  gdm: 'gdm',
  common: 'common',
}

const SHAPES: ComponentType['shape'][] = [
  'pump',
  'column',
  'vessel',
  'heatexchanger',
  'valve',
  'sensor',
  'controller',
  'separator',
  'compressor',
  'furnace',
]

/** Infer Konva/palette shape from API model_code / id (seeds have no `shape`). */
export function inferComponentShape(
  modelCode: string,
  id: string,
  explicit?: unknown,
): ComponentType['shape'] {
  if (typeof explicit === 'string' && (SHAPES as string[]).includes(explicit)) {
    return explicit as ComponentType['shape']
  }
  const key = `${modelCode} ${id}`.toLowerCase()
  const rules: Array<[RegExp, ComponentType['shape']]> = [
    [/pump|насос/, 'pump'],
    [/furnace|печ|heater|superheater/, 'furnace'],
    [/column|колон|distill|stripp|stabiliz/, 'column'],
    [/heat_?exchanger|cooler|condenser|теплообмен/, 'heatexchanger'],
    [/compressor|компрес/, 'compressor'],
    [/separator|сепар|demister/, 'separator'],
    [/valve|клапан|задвиж|doser/, 'valve'],
    [/sensor|kip|датчик|transmitter/, 'sensor'],
    [/controller|pid|регулятор/, 'controller'],
    [/vessel|ёмкость|емкость|tank|dehydrator|reactor|mixer|source|sink|ipm|transformer/, 'vessel'],
  ]
  for (const [re, shape] of rules) {
    if (re.test(key)) return shape
  }
  return 'vessel'
}

function mapParamType(raw: unknown): ComponentType['parameters'][number]['type'] {
  const t = String(raw ?? 'string').toLowerCase()
  if (t === 'float' || t === 'int' || t === 'number' || t === 'integer') return 'number'
  if (t === 'bool' || t === 'boolean') return 'boolean'
  if (t === 'select' || t === 'enum') return 'enum'
  return 'string'
}

function mapPortType(raw: unknown): ComponentType['ports'][number]['type'] {
  const t = String(raw ?? 'liquid').toLowerCase()
  if (t === 'liquid' || t === 'gas' || t === 'steam' || t === 'signal' || t === 'electric') return t
  return 'liquid'
}

/** Normalize constructor API / import payloads to the SPA ComponentType (mock-compatible). */
export function mapComponent(raw: unknown): ComponentType {
  const r = asRecord(raw)
  const id = str(r.id)
  const modelCode = str(pick(r, 'model_code', 'modelCode'), id)
  const categoryRaw = str(r.category, 'common')
  // Map known Russian/English keys; keep custom API categories as-is.
  const category = CATEGORY_FROM_API[categoryRaw] ?? categoryRaw

  const portsRaw = Array.isArray(r.ports) ? r.ports : []
  const ports = portsRaw.map((p, i) => {
    const pr = asRecord(p)
    return {
      id: str(pr.id, `port-${i}`),
      name: str(pr.name, str(pr.id, `port-${i}`)),
      type: mapPortType(pr.type),
      direction: str(pr.direction, 'in') === 'out' ? ('out' as const) : ('in' as const),
    }
  })

  const paramsRaw = Array.isArray(r.parameters) ? r.parameters : []
  const parameters = paramsRaw.map((p, i) => {
    const pr = asRecord(p)
    const name = str(pr.name, str(pr.id, `p-${i}`))
    const label = str(pr.label, name)
    const defaultValue = pr.defaultValue !== undefined ? pr.defaultValue : pr.default
    return {
      id: str(pr.id, `p-${i}`),
      name,
      label,
      type: mapParamType(pr.type),
      unit: str(pr.unit) || undefined,
      defaultValue,
      options: Array.isArray(pr.options) ? pr.options.map(String) : undefined,
      min: typeof pr.min === 'number' ? pr.min : undefined,
      max: typeof pr.max === 'number' ? pr.max : undefined,
      required: Boolean(pr.required),
    }
  })

  return {
    id,
    name: str(r.name, id),
    category,
    description: str(r.description),
    shape: inferComponentShape(modelCode, id, r.shape),
    ports,
    parameters,
  }
}

export function mapSession(raw: unknown): SessionRecord {
  const r = asRecord(raw)
  const statusRaw = str(pick(r, 'status', 'status'), 'idle')
  const status = statusRaw === 'created' ? 'idle' : (statusRaw as SessionRecord['status'])

  const operatorIds = (pick(r, 'operator_ids', 'operatorIds') as string[] | undefined) ?? []
  const modeRaw = str(pick(r, 'mode', 'mode'), 'training')
  const mode: SessionRecord['mode'] = modeRaw === 'exam' ? 'exam' : 'training'

  return {
    id: str(r.id),
    templateId: str(pick(r, 'template_id', 'templateId')),
    templateName: str(
      pick(r, 'template_name', 'templateName'),
      str(pick(r, 'template_id', 'templateId')),
    ),
    operatorId: str(pick(r, 'operator_id', 'operatorId') ?? operatorIds[0]),
    operatorIds,
    operatorName: str(
      pick(r, 'operator_name', 'operatorName'),
      str(pick(r, 'operator_id', 'operatorId') ?? operatorIds[0]),
    ),
    instructorId: str(pick(r, 'instructor_id', 'instructorId')),
    scenarioId: str(pick(r, 'scenario_id', 'scenarioId')) || undefined,
    scenarioName: str(pick(r, 'scenario_name', 'scenarioName')) || undefined,
    mode,
    status,
    startedAt: (pick(r, 'started_at', 'startedAt') as string | null) ?? null,
    finishedAt: (pick(r, 'stopped_at', 'finishedAt') as string | null) ?? null,
    speed: num(pick(r, 'speed', 'speed'), 1),
    reportId: str(pick(r, 'report_id', 'reportId')) || undefined,
  }
}

export interface SnapshotMeta {
  id: string
  sessionId: string
  name: string
  modelTime?: number
  createdAt?: string
  isPreset?: boolean
}

export function mapSnapshot(raw: unknown): SnapshotMeta {
  const r = asRecord(raw)
  return {
    id: str(r.id),
    sessionId: str(pick(r, 'session_id', 'sessionId')),
    name: str(pick(r, 'name', 'label')),
    modelTime:
      typeof pick(r, 'model_time', 'modelTime') === 'number'
        ? num(pick(r, 'model_time', 'modelTime'))
        : undefined,
    createdAt: str(pick(r, 'created_at', 'createdAt')) || undefined,
    isPreset: Boolean(pick(r, 'is_preset', 'isPreset')),
  }
}

export interface ReportMeta {
  id: string
  sessionId: string
  type: 'session' | 'exam'
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'generating'
  downloadUrl?: string
  createdAt: string
}

export function mapReport(raw: unknown): ReportMeta {
  const r = asRecord(raw)
  const status = str(pick(r, 'status', 'status'), 'queued') as ReportMeta['status']
  const type = str(pick(r, 'type', 'type'), 'session') as ReportMeta['type']
  return {
    id: str(r.id),
    sessionId: str(pick(r, 'session_id', 'sessionId')),
    type: type === 'exam' ? 'exam' : 'session',
    status,
    downloadUrl: str(pick(r, 'download_url', 'downloadUrl')) || undefined,
    createdAt: str(pick(r, 'created_at', 'createdAt')),
  }
}

export interface ScoreData {
  sessionId: string
  score: number
  maxScore: number
  penalties: {
    id: string
    description: string
    deduction: number
    timestamp: number
    isCritical?: boolean
  }[]
  criticalErrors: { id: string; description: string; timestamp: number }[]
  aiAnalysis: string
  completedAt: string
  verdict?: string
}

export function mapScore(raw: unknown): ScoreData {
  const r = asRecord(raw)
  const penaltiesRaw = (pick(r, 'penalties', 'penalties') as unknown[]) ?? []
  const criticalRaw = (pick(r, 'critical_errors', 'criticalErrors') as unknown[]) ?? []

  const penalties = penaltiesRaw.map((p, i) => {
    const item = asRecord(p)
    return {
      id: str(item.id ?? item.code, `pen-${i}`),
      description: str(item.description),
      deduction: num(item.deduction ?? item.points),
      timestamp: num(item.timestamp ?? item.model_time),
      isCritical: Boolean(item.isCritical),
    }
  })

  const criticalErrors = criticalRaw.map((c, i) => {
    const item = asRecord(c)
    return {
      id: str(item.id ?? item.code, `ce-${i}`),
      description: str(item.description),
      timestamp: num(item.timestamp ?? item.model_time),
    }
  })

  return {
    sessionId: str(pick(r, 'session_id', 'sessionId')),
    score: num(pick(r, 'total_score', 'score')),
    maxScore: num(pick(r, 'max_score', 'maxScore'), 100),
    penalties,
    criticalErrors,
    aiAnalysis: str(pick(r, 'ai_analysis', 'aiAnalysis')),
    completedAt: str(pick(r, 'completed_at', 'completedAt'), new Date().toISOString()),
    verdict: str(pick(r, 'verdict', 'verdict')) || undefined,
  }
}

export interface ReplayEvent {
  time: number
  type: string
  description: string
  severity?: string
}

export interface ReplayData {
  duration: number
  events: ReplayEvent[]
}

export function mapReplay(raw: unknown): ReplayData {
  const r = asRecord(raw)
  const events: ReplayEvent[] = []

  const describe = (e: Record<string, unknown>, fallbackType: string): string => {
    const explicit = str(e.description ?? e.message ?? e.name)
    if (explicit) return explicit
    if (fallbackType === 'action') {
      const parts = [str(e.type), str(e.target), str(e.action)].filter(Boolean)
      return parts.length ? parts.join(' · ') : 'Действие оператора'
    }
    if (fallbackType === 'fault') {
      const parts = [str(e.fault_id), str(e.component ?? e.component_instance_id)].filter(Boolean)
      return parts.length ? parts.join(' · ') : 'Неисправность'
    }
    if (fallbackType === 'alarm') {
      const parts = [str(e.tag_id), str(e.priority)].filter(Boolean)
      return parts.length ? parts.join(' · ') : 'Авария'
    }
    return fallbackType
  }

  const pushMany = (arr: unknown, fallbackType: string) => {
    if (!Array.isArray(arr)) return
    for (const item of arr) {
      const e = asRecord(item)
      events.push({
        time: num(e.time ?? e.model_time ?? e.timestamp),
        type: fallbackType === 'action' ? str(e.type, 'action') : fallbackType,
        description: describe(e, fallbackType),
        severity: str(e.severity ?? e.priority) || undefined,
      })
    }
  }

  if (Array.isArray(r.events)) {
    pushMany(r.events, 'action')
  } else {
    pushMany(r.actions, 'action')
    pushMany(r.alarms, 'alarm')
    pushMany(r.faults, 'fault')
    pushMany(r.penalties, 'penalty')
  }

  events.sort((a, b) => a.time - b.time)
  const duration = num(
    r.duration,
    events.length ? Math.max(...events.map((e) => e.time)) + 60 : 900,
  )
  return { duration, events }
}
