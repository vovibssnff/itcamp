import { apiClient } from './client'
import { unwrap, unwrapVoid } from './request'
import { postImport, type ImportResult } from './import'

const BASE_URL =
  import.meta.env.VITE_MOCK_API === 'true' ? '' : (import.meta.env.VITE_API_BASE_URL ?? '')

function toScenarioBody(body: unknown): Record<string, unknown> {
  const r = (body ?? {}) as Record<string, unknown>
  return {
    template_id: r.template_id ?? r.templateId,
    name: r.name,
    description: r.description ?? '',
    type: r.type,
    start_preset_id: r.start_preset_id ?? r.startPresetId,
    faults: r.faults ?? [],
    reference_actions: r.reference_actions ?? r.referenceActions ?? [],
    criteria: r.criteria ?? {},
  }
}

/** Scenario payloads keep frontend-friendly shapes; MSW + backend both accepted via passthrough. */
export const scenariosApi = {
  async list(query?: Record<string, string>): Promise<unknown[]> {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : ''
    // Drop FE-only status filter against real API (schema has no status).
    const q = { ...(query ?? {}) }
    if (import.meta.env.VITE_MOCK_API !== 'true') {
      delete q.status
    }
    const raw = await unwrap<unknown>(
      apiClient.GET('/api/v1/scenarios', {
        params: { query: q as never },
      }),
    )
    void qs
    // Backend writes a bare JSON array (nil slice → null). OpenAPI documents
    // `{ scenarios: [...] }` — accept both so the operator picker never crashes.
    if (Array.isArray(raw)) return raw
    if (
      raw &&
      typeof raw === 'object' &&
      Array.isArray((raw as { scenarios?: unknown }).scenarios)
    ) {
      return (raw as { scenarios: unknown[] }).scenarios
    }
    return []
  },

  async get(id: string): Promise<unknown> {
    return unwrap<unknown>(apiClient.GET('/api/v1/scenarios/{id}', { params: { path: { id } } }))
  },

  async create(body: unknown): Promise<unknown> {
    return unwrap<unknown>(
      apiClient.POST('/api/v1/scenarios', { body: toScenarioBody(body) as never }),
    )
  },

  async update(id: string, body: unknown): Promise<unknown> {
    return unwrap<unknown>(
      apiClient.PUT('/api/v1/scenarios/{id}', {
        params: { path: { id } },
        body: toScenarioBody(body) as never,
      }),
    )
  },

  async remove(id: string): Promise<void> {
    await unwrapVoid(apiClient.DELETE('/api/v1/scenarios/{id}', { params: { path: { id } } }))
  },

  async clone(id: string, body?: unknown): Promise<unknown> {
    return unwrap<unknown>(
      apiClient.POST('/api/v1/scenarios/{id}/clone', {
        params: { path: { id } },
        body: (body ?? {}) as never,
      }),
    )
  },

  async listFaults(): Promise<unknown[]> {
    const raw = await unwrap<unknown[]>(apiClient.GET('/api/v1/faults'))
    return raw ?? []
  },

  async importFaults(payload: { faults: unknown[] } | unknown[]): Promise<ImportResult> {
    const body = Array.isArray(payload) ? { faults: payload } : payload
    return postImport<ImportResult>('/api/v1/faults/import', body)
  },

  async importScenarios(payload: { scenarios: unknown[] } | unknown[]): Promise<ImportResult> {
    const body = Array.isArray(payload) ? { scenarios: payload } : payload
    return postImport<ImportResult>('/api/v1/scenarios/import', body)
  },

  /** Not in gateway — mock-only AI generate kept on /api/scenarios/ai-generate. */
  async aiGenerate(body: unknown): Promise<unknown> {
    const res = await fetch(`${BASE_URL}/api/scenarios/ai-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
}
