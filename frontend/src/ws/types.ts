import type { TagValue, ActiveAlarm, RegulatorState, SessionStatus } from '@/store/session'

// Server → Client messages
export type ServerMessage =
  | { type: 'telemetry'; tags: TagValue[] }
  | { type: 'alarm'; alarm: ActiveAlarm }
  | { type: 'alarm_clear'; id: string }
  | { type: 'session_status'; status: SessionStatus; modelTime: number; speed: number }
  | { type: 'regulator_state'; regulator: RegulatorState }
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
