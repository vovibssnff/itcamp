import { apiClient } from './client'
import { unwrap, unwrapVoid } from './request'
import { mapSession } from './mappers'
import type { SessionRecord } from '@/types'

export type SessionAction =
  'start' | 'pause' | 'resume' | 'stop' | 'checkpoint' | 'restore' | 'actuator'

export interface CreateSessionInput {
  templateId: string
  scenarioId: string
  operatorIds: string[]
  mode: 'training' | 'exam' | 'demo'
  speed?: number
}

const ACTION_PATHS = {
  start: '/api/v1/sessions/{id}/start',
  pause: '/api/v1/sessions/{id}/pause',
  resume: '/api/v1/sessions/{id}/resume',
  stop: '/api/v1/sessions/{id}/stop',
  checkpoint: '/api/v1/sessions/{id}/checkpoint',
  restore: '/api/v1/sessions/{id}/restore',
  actuator: '/api/v1/sessions/{id}/actuator',
} as const

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

  async action(id: string, action: 'start' | 'pause' | 'resume' | 'stop'): Promise<SessionRecord> {
    const path = ACTION_PATHS[action]
    const raw = await unwrap<unknown>(apiClient.POST(path, { params: { path: { id } } } as never))
    return mapSession(raw)
  },

  async setSpeed(id: string, speed: number): Promise<void> {
    await unwrap<unknown>(
      apiClient.PUT('/api/v1/sessions/{id}/speed', {
        params: { path: { id } },
        body: { factor: speed } as never,
      }),
    )
  },

  async checkpoint(id: string, name: string): Promise<{ snapshot_id?: string }> {
    const raw = await unwrap<{ snapshot_id?: string }>(
      apiClient.POST('/api/v1/sessions/{id}/checkpoint', {
        params: { path: { id } },
        body: { name } as never,
      }),
    )
    return raw ?? {}
  },

  async restore(id: string, snapshotId: string): Promise<SessionRecord> {
    const raw = await unwrap<unknown>(
      apiClient.POST('/api/v1/sessions/{id}/restore', {
        params: { path: { id } },
        body: { snapshot_id: snapshotId } as never,
      }),
    )
    return mapSession(raw)
  },

  async actuator(id: string, tag: string, value: unknown): Promise<void> {
    await unwrapVoid(
      apiClient.POST('/api/v1/sessions/{id}/actuator', {
        params: { path: { id } },
        body: { tag, value } as never,
      }),
    )
  },

  /** Acknowledge an alarm via REST (used by instructor in observe channel). */
  async ackAlarm(sessionId: string, alarmId: string): Promise<void> {
    await unwrapVoid(
      apiClient.POST('/api/v1/sessions/{id}/alarms/{alarm_id}/ack', {
        params: { path: { id: sessionId, alarm_id: alarmId } },
      }),
    )
  },
}
