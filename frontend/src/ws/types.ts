import type {
  TagValue,
  ActiveAlarm,
  RegulatorState,
  SessionStatus,
  ActiveFault,
} from '@/store/session'
import { normalizeTagId } from '@/store/session'

// Server → Client messages
export type ServerMessage =
  | { type: 'telemetry'; tags: TagValue[] }
  | { type: 'alarm'; alarm: ActiveAlarm }
  | { type: 'alarm_clear'; id: string }
  | { type: 'session_status'; status: SessionStatus; modelTime: number; speed: number }
  | { type: 'regulator_state'; regulator: RegulatorState }
  | { type: 'fault'; fault: ActiveFault }
  | { type: 'ai_hint'; text: string; tag?: string; confidence?: number }
  | { type: 'pong' }

// Client → Server messages
export type ClientMessage =
  | { type: 'actuator'; tag: string; value: number }
  | { type: 'ack_alarm'; id: string }
  | { type: 'regulator_sp'; tag: string; sp: number }
  | { type: 'regulator_mode'; tag: string; mode: 'auto' | 'manual' }
  | { type: 'regulator_out'; tag: string; out: number }
  | { type: 'subscribe'; tags: string[] }
  | { type: 'ping' }

const ALARM_LEVELS = new Set(['L', 'LL', 'H', 'HH'])

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : fallback
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

/** Normalize inbound WS payloads — backend may send tags as map or array, snake_case fields. */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  const msg = asRecord(raw)
  const type = str(msg.type)
  if (!type) return null

  switch (type) {
    case 'telemetry': {
      const tags: TagValue[] = []
      if (Array.isArray(msg.tags)) {
        for (const item of msg.tags) {
          const t = asRecord(item)
          const tag = normalizeTagId(str(t.tag ?? t.tag_id ?? t.id))
          if (!tag) continue
          const alarmRaw = str(t.alarmState ?? t.alarm_state ?? t.state, 'normal')
          tags.push({
            tag,
            value: num(t.value),
            unit: str(t.unit),
            alarmState: (ALARM_LEVELS.has(alarmRaw)
              ? alarmRaw
              : 'normal') as TagValue['alarmState'],
            timestamp: num(t.timestamp ?? t.model_time, Date.now()),
          })
        }
      } else if (msg.tags && typeof msg.tags === 'object') {
        // { "PRSA 204": 1.2, ... } or { "PRSA 204": { value, unit, ... } }
        for (const [k, v] of Object.entries(msg.tags as Record<string, unknown>)) {
          const tag = normalizeTagId(k)
          if (!tag) continue
          if (typeof v === 'number') {
            tags.push({
              tag,
              value: v,
              unit: '',
              alarmState: 'normal',
              timestamp: Date.now(),
            })
          } else {
            const t = asRecord(v)
            const alarmRaw = str(t.alarmState ?? t.alarm_state, 'normal')
            tags.push({
              tag,
              value: num(t.value),
              unit: str(t.unit),
              alarmState: (ALARM_LEVELS.has(alarmRaw)
                ? alarmRaw
                : 'normal') as TagValue['alarmState'],
              timestamp: num(t.timestamp, Date.now()),
            })
          }
        }
      } else if (msg.data && typeof msg.data === 'object') {
        // legacy { type, data: {...} } snapshot
        return parseServerMessage({ type: 'telemetry', tags: msg.data })
      }
      return { type: 'telemetry', tags }
    }

    case 'alarm': {
      const a = asRecord(msg.alarm ?? msg)
      const levelRaw = str(a.level ?? a.priority ?? a.alarm_state, 'H')
      const level = (ALARM_LEVELS.has(levelRaw) ? levelRaw : 'H') as ActiveAlarm['level']
      return {
        type: 'alarm',
        alarm: {
          id: str(a.id, `alarm-${Date.now()}`),
          tag: normalizeTagId(str(a.tag ?? a.tag_id)),
          level,
          message: str(a.message ?? a.description, str(a.tag)),
          timestamp: num(a.timestamp ?? a.model_time, Date.now()),
          acknowledged: Boolean(a.acknowledged),
        },
      }
    }

    case 'alarm_clear':
      return { type: 'alarm_clear', id: str(msg.id ?? msg.alarm_id) }

    case 'session_status':
      return {
        type: 'session_status',
        status: str(msg.status, 'idle') as SessionStatus,
        modelTime: num(msg.modelTime ?? msg.model_time),
        speed: num(msg.speed, 1),
      }

    case 'regulator_state': {
      const r = asRecord(msg.regulator ?? msg)
      return {
        type: 'regulator_state',
        regulator: {
          tag: normalizeTagId(str(r.tag ?? r.tag_id)),
          mode: str(r.mode, 'auto') === 'manual' ? 'manual' : 'auto',
          pv: num(r.pv),
          sp: num(r.sp),
          out: num(r.out),
        },
      }
    }

    case 'fault': {
      const f = asRecord(msg.fault ?? msg)
      const faultId = str(f.fault_id ?? f.faultId ?? f.id)
      return {
        type: 'fault',
        fault: {
          id: str(f.id, faultId || `fault-${Date.now()}`),
          faultId,
          componentId: str(f.component_id ?? f.componentId) || undefined,
          message: str(f.message ?? f.description, faultId),
          timestamp: num(f.timestamp ?? f.model_time, Date.now()),
        },
      }
    }

    case 'ai_hint':
      return {
        type: 'ai_hint',
        text: str(msg.text ?? msg.message),
        tag: str(msg.tag) || undefined,
        confidence: typeof msg.confidence === 'number' ? msg.confidence : undefined,
      }

    case 'pong':
      return { type: 'pong' }

    default:
      return null
  }
}
