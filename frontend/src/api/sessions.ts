import { apiClient } from './client'
import { unwrap } from './request'
import { mapSession } from './mappers'
import type { SessionRecord } from '@/mocks/fixtures/sessions'

/** Gateway enum is start|pause|resume|stop|checkpoint|restore|actuator. */
export type SessionAction =
  'start' | 'pause' | 'resume' | 'stop' | 'checkpoint' | 'restore' | 'actuator'

export interface CreateSessionInput {
  templateId: string
  scenarioId: string
  operatorIds: string[]
  mode: 'training' | 'exam' | 'demo'
  speed?: number
}

export const sessionsApi = {
  async list(): Promise<SessionRecord[]> {
    const raw = await unwrap<unknown[]>(apiClient.GET('/api/v1/sessions'))
    return (raw ?? []).map(mapSession)
  },

  async get(id: string): Promise<SessionRecord> {
    const raw = await unwrap<unknown>(
      apiClient.GET('/api/v1/sessions/{id}', { params: { path: { id } } }),
    )
    return mapSession(raw)
  },

  async create(input: CreateSessionInput): Promise<SessionRecord> {
    const raw = await unwrap<unknown>(
      apiClient.POST('/api/v1/sessions', {
        body: {
          template_id: input.templateId,
          scenario_id: input.scenarioId,
          operator_ids: input.operatorIds,
          mode: input.mode,
          speed: input.speed ?? 1,
        } as never,
      }),
    )
    return mapSession(raw)
  },

  async action(
    id: string,
    action: SessionAction,
    body?: unknown,
  ): Promise<SessionRecord | unknown> {
    const raw = await unwrap<unknown>(
      apiClient.POST('/api/v1/sessions/{id}/{action}', {
        params: {
          path: {
            id,
            action,
          },
        },
        body: (body ?? {}) as never,
      }),
    )
    // Action responses may be a session or a simple ack.
    if (raw && typeof raw === 'object' && 'id' in (raw as object)) {
      return mapSession(raw)
    }
    return raw
  },

  async setSpeed(id: string, speed: number): Promise<void> {
    await unwrap<unknown>(
      apiClient.PUT('/api/v1/sessions/{id}/speed', {
        params: { path: { id } },
        body: { factor: speed } as never,
      }),
    )
  },

  async checkpoint(id: string, name: string): Promise<unknown> {
    return unwrap<unknown>(
      apiClient.POST('/api/v1/sessions/{id}/{action}', {
        params: { path: { id, action: 'checkpoint' } },
        body: { name } as never,
      }),
    )
  },

  async restore(id: string, snapshotId: string): Promise<unknown> {
    return unwrap<unknown>(
      apiClient.POST('/api/v1/sessions/{id}/{action}', {
        params: { path: { id, action: 'restore' } },
        body: { snapshot_id: snapshotId } as never,
      }),
    )
  },
}
