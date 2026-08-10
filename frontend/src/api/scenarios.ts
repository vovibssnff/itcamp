import { apiClient } from './client'
import { unwrap, unwrapVoid } from './request'

const BASE_URL =
  import.meta.env.VITE_MOCK_API === 'true' ? '' : (import.meta.env.VITE_API_BASE_URL ?? '')

/** Scenario payloads keep frontend-friendly shapes; MSW + backend both accepted via passthrough. */
export const scenariosApi = {
  async list(query?: Record<string, string>): Promise<unknown[]> {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : ''
    // Use authenticated client path for list; query typing on gw is sparse.
    const raw = await unwrap<unknown[]>(
      apiClient.GET('/api/v1/scenarios', {
        params: { query: query as never },
      }),
    )
    if (Array.isArray(raw)) return raw
    // Fallback if client dropped query — rare
    void qs
    return []
  },

  async get(id: string): Promise<unknown> {
    return unwrap<unknown>(apiClient.GET('/api/v1/scenarios/{id}', { params: { path: { id } } }))
  },

  async create(body: unknown): Promise<unknown> {
    return unwrap<unknown>(apiClient.POST('/api/v1/scenarios', { body: body as never }))
  },

  async update(id: string, body: unknown): Promise<unknown> {
    return unwrap<unknown>(
      apiClient.PUT('/api/v1/scenarios/{id}', {
        params: { path: { id } },
        body: body as never,
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
