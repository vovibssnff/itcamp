import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { API_BASE, CREDS, ensureOperatorProvisioned } from './auth'
import { fixturesDir } from './paths'
import { totp } from '../totp'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const tokenCache = new Map<string, { token: string; exp: number }>()

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function fetchLogin(body: Record<string, string>, attempt = 0): Promise<Response> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 429 && attempt < 5) {
    await sleep(15_000 + attempt * 5_000)
    return fetchLogin(body, attempt + 1)
  }
  return res
}

async function mfaLogin(role: 'instructor' | 'admin'): Promise<string> {
  const { login, password, secretFile, envSecret } = CREDS[role]
  const res = await fetchLogin({ login, password })
  const data = (await res.json()) as {
    mfa_required?: boolean
    enrollment_token?: string
    secret?: string
    access_token?: string
  }
  if (data.access_token) return data.access_token

  let secret = envSecret
  if (!secret && existsSync(secretFile)) secret = readFileSync(secretFile, 'utf8').trim()
  if (data.secret) {
    mkdirSync(dirname(secretFile), { recursive: true })
    writeFileSync(secretFile, data.secret, 'utf8')
    secret = data.secret
  } else if (data.enrollment_token) {
    const enr = await fetch(`${API_BASE}/api/v1/auth/mfa/enrollment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.enrollment_token}`,
        Accept: 'application/json',
      },
    })
    if (!enr.ok) throw new Error(`enrollment: ${enr.status}`)
    const body = (await enr.json()) as { secret: string }
    mkdirSync(dirname(secretFile), { recursive: true })
    writeFileSync(secretFile, body.secret, 'utf8')
    secret = body.secret
  }
  if (!secret) throw new Error(`${role}: no MFA secret for API login`)

  const verify = await fetchLogin({ login, password, mfa_code: totp(secret) })
  if (!verify.ok) throw new Error(`mfa login: ${verify.status} ${await verify.text()}`)
  const tokens = (await verify.json()) as { access_token?: string; mfa_required?: boolean }
  if (!tokens.access_token) {
    throw new Error(`${role}: MFA login failed: ${JSON.stringify(tokens)}`)
  }
  return tokens.access_token
}

export async function apiToken(
  role: 'instructor' | 'admin' | 'operator' = 'instructor',
): Promise<string> {
  const cached = tokenCache.get(role)
  if (cached && cached.exp > Date.now()) return cached.token

  let token: string
  if (role === 'operator') {
    await ensureOperatorProvisioned()
    const { login, password } = CREDS.operator
    const res = await fetchLogin({ login, password })
    if (!res.ok) throw new Error(`operator login: ${res.status}`)
    const data = (await res.json()) as { access_token: string }
    token = data.access_token
  } else {
    token = await mfaLogin(role)
  }
  // Access TTL is 15m in compose; refresh cache a bit earlier.
  tokenCache.set(role, { token, exp: Date.now() + 12 * 60_000 })
  return token
}

async function apiFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}: ${text}`)
  }
  return body
}

export async function apiImportComponents(
  token: string,
  file = join(fixturesDir(), 'components.min.json'),
) {
  const payload = JSON.parse(readFileSync(file, 'utf8'))
  return apiFetch('/api/v1/components/import', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function apiImportFaults(
  token: string,
  file = join(fixturesDir(), 'faults.min.json'),
) {
  const payload = JSON.parse(readFileSync(file, 'utf8'))
  return apiFetch('/api/v1/faults/import', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function apiImportTemplate(
  token: string,
  file = join(fixturesDir(), 'template.min.json'),
): Promise<{ id: string; name: string }> {
  const payload = JSON.parse(readFileSync(file, 'utf8')) as { name?: string }
  // Unique name avoids collisions across serial live runs.
  if (payload.name) payload.name = `${payload.name} ${Date.now().toString(36)}`
  const body = (await apiFetch('/api/v1/templates/import', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })) as { template?: { id: string; name: string }; id?: string; name?: string }
  const t = body.template ?? body
  if (!t.id || !t.name) throw new Error(`template import unexpected: ${JSON.stringify(body)}`)
  return { id: t.id, name: t.name }
}

export async function apiImportScenario(
  token: string,
  templateId: string,
  opts?: { name?: string; atModelTime?: number; type?: string; file?: string },
): Promise<{ id: string; name: string }> {
  const file = opts?.file ?? join(fixturesDir(), 'scenario.min.json')
  const tpl = JSON.parse(readFileSync(file, 'utf8')) as {
    scenarios: Array<{
      id?: string
      template_id: string
      name: string
      type?: string
      faults?: Array<{ trigger?: { at_model_time?: number } }>
    }>
  }
  const sc = tpl.scenarios[0]!
  sc.id = `sc-e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  sc.template_id = templateId
  if (opts?.name) sc.name = opts.name
  if (opts?.type) sc.type = opts.type
  if (opts?.atModelTime != null && sc.faults?.[0]?.trigger) {
    sc.faults[0].trigger.at_model_time = opts.atModelTime
  }
  const body = (await apiFetch('/api/v1/scenarios/import', token, {
    method: 'POST',
    body: JSON.stringify(tpl),
  })) as { created?: number; updated?: number; errors?: unknown[] }

  if (body.errors && Array.isArray(body.errors) && body.errors.length > 0) {
    throw new Error(`scenario import errors: ${JSON.stringify(body.errors)}`)
  }
  if (!(body.created || body.updated)) {
    throw new Error(`scenario import empty result: ${JSON.stringify(body)}`)
  }

  // Prefer GET by id — list defaults to limit=50 and drops older/newer rows.
  try {
    const got = (await apiFetch(`/api/v1/scenarios/${sc.id}`, token)) as {
      id: string
      name: string
    }
    if (got?.id) return { id: got.id, name: got.name ?? sc.name }
  } catch {
    /* fall through */
  }
  const list = (await apiFetch(
    `/api/v1/scenarios?limit=200&q=${encodeURIComponent(sc.name)}`,
    token,
  )) as Array<{ id: string; name: string }>
  const found = list.find((s) => s.id === sc.id) ?? list.find((s) => s.name === sc.name)
  if (!found) throw new Error(`scenario "${sc.name}" not found after import`)
  return found
}

export async function apiListUsers(
  token: string,
): Promise<Array<{ id: string; login?: string; username?: string }>> {
  const body = (await apiFetch('/api/v1/users', token)) as Array<{
    id: string
    login?: string
    username?: string
  }>
  return body
}

export async function apiFindOperatorId(token: string): Promise<string> {
  await ensureOperatorProvisioned()
  const users = await apiListUsers(token)
  const op = users.find((u) => {
    const name = (u.login ?? u.username ?? '').toLowerCase()
    return name.includes('operator')
  })
  if (!op) throw new Error('operator user not found in /users')
  return op.id
}

export async function apiCreateSession(
  token: string,
  input: {
    templateId: string
    scenarioId: string
    operatorId: string
    mode?: 'training' | 'exam' | 'demo'
  },
): Promise<{ id: string; status: string }> {
  return (await apiFetch('/api/v1/sessions', token, {
    method: 'POST',
    body: JSON.stringify({
      template_id: input.templateId,
      scenario_id: input.scenarioId,
      operator_ids: [input.operatorId],
      mode: input.mode ?? 'training',
      speed: 1,
    }),
  })) as { id: string; status: string }
}

export async function apiSessionAction(
  token: string,
  sessionId: string,
  action: string,
  body: unknown = {},
) {
  return apiFetch(`/api/v1/sessions/${sessionId}/${action}`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function apiGetSession(token: string, sessionId: string) {
  return apiFetch(`/api/v1/sessions/${sessionId}`, token) as Promise<{
    id: string
    status: string
    mode?: string
    model_time?: number
  }>
}

export interface ReplayTimeline {
  actions: Array<{ target?: string; model_time?: number }> | null
  alarms: Array<{ tag?: string; level?: string; model_time?: number }> | null
  faults: Array<{ fault_id: string; component?: string; model_time?: number }> | null
}

/** Assessment replay is the only REST view of what the sim actually did. */
export async function apiSessionReplay(token: string, sessionId: string): Promise<ReplayTimeline> {
  return (await apiFetch(`/api/v1/assessment/session/${sessionId}/replay`, token)) as ReplayTimeline
}

export async function apiListSnapshots(
  token: string,
  sessionId: string,
): Promise<Array<{ id: string; name: string; session_id: string; model_time?: number }>> {
  const body = (await apiFetch(`/api/v1/snapshots?session_id=${sessionId}`, token)) as Array<{
    id: string
    name: string
    session_id: string
    model_time?: number
  }> | null
  return body ?? []
}

/** Fault ids the sim-worker catalog actually knows (`sim-engine/data/faults_catalog.json`). */
export const SIM_FAULTS = {
  k1PressureHigh: 'FLT-K1-PRESSURE-HIGH',
  k1LevelLow: 'FLT-K1-LEVEL-LOW',
  feedFlowLow: 'FLT-FEED-FLOW-LOW',
  p3CotHigh: 'FLT-P3-COT-HIGH',
  iaPressureLow: 'FLT-IA-PRESSURE-LOW',
} as const

/** Seed components/faults/template/scenario and optionally create+start a session. */
export async function apiSeedStack(opts?: {
  templateFile?: string
  scenarioName?: string
  atModelTime?: number
  mode?: 'training' | 'exam' | 'demo'
  start?: boolean
}): Promise<{
  token: string
  templateId: string
  templateName: string
  scenarioId: string
  scenarioName: string
  sessionId?: string
}> {
  const token = await apiToken('instructor')
  await apiImportComponents(token)
  await apiImportFaults(token)
  const tpl = await apiImportTemplate(
    token,
    opts?.templateFile ?? join(fixturesDir(), 'template.min.json'),
  )
  const scName = opts?.scenarioName ?? `E2E Seed ${Date.now()}`
  const sc = await apiImportScenario(token, tpl.id, {
    name: scName,
    atModelTime: opts?.atModelTime ?? 15,
    type: opts?.mode === 'exam' ? 'exam' : 'training',
  })
  const result: {
    token: string
    templateId: string
    templateName: string
    scenarioId: string
    scenarioName: string
    sessionId?: string
  } = {
    token,
    templateId: tpl.id,
    templateName: tpl.name,
    scenarioId: sc.id,
    scenarioName: sc.name,
  }
  if (opts?.start) {
    const operatorId = await apiFindOperatorId(token)
    const session = await apiCreateSession(token, {
      templateId: tpl.id,
      scenarioId: sc.id,
      operatorId,
      mode: opts.mode ?? 'training',
    })
    await apiSessionAction(token, session.id, 'start')
    result.sessionId = session.id
  }
  return result
}

export function writeBoundScenarioFixture(
  templateId: string,
  opts?: { name?: string; atModelTime?: number; type?: string },
): string {
  const fx = fixturesDir()
  const tpl = JSON.parse(readFileSync(join(fx, 'scenario.min.json'), 'utf8')) as {
    scenarios: Array<{
      id?: string
      template_id: string
      name: string
      type?: string
      faults?: Array<{ trigger?: { at_model_time?: number } }>
    }>
  }
  tpl.scenarios[0]!.id = `sc-e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  tpl.scenarios[0]!.template_id = templateId
  if (opts?.name) tpl.scenarios[0]!.name = opts.name
  if (opts?.type) tpl.scenarios[0]!.type = opts.type
  if (opts?.atModelTime != null && tpl.scenarios[0]!.faults?.[0]?.trigger) {
    tpl.scenarios[0]!.faults[0]!.trigger!.at_model_time = opts.atModelTime
  }
  const tmp = mkdtempSync(join(tmpdir(), 'ktk-e2e-'))
  const path = join(tmp, 'scenario.json')
  writeFileSync(path, JSON.stringify(tpl))
  return path
}
