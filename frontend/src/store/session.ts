import { create } from 'zustand'

export type SessionStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'finished'

export interface TagValue {
  tag: string
  value: number
  unit: string
  alarmState: 'normal' | 'L' | 'LL' | 'H' | 'HH'
  timestamp: number
}

export interface ActiveAlarm {
  id: string
  tag: string
  level: 'L' | 'LL' | 'H' | 'HH'
  message: string
  timestamp: number
  acknowledged: boolean
}

export interface RegulatorState {
  tag: string
  mode: 'auto' | 'manual'
  pv: number
  sp: number
  out: number
}

export interface ActiveFault {
  id: string
  faultId: string
  componentId?: string
  message: string
  timestamp: number
}

/**
 * Canonical tag form is sim-engine space IDs ("PRSA 204").
 * Accepts hyphen / underscore / ".PV" variants from scenarios and mocks.
 */
export function normalizeTagId(tag: string): string {
  return tag
    .replace(/\.PV$/i, '')
    .replace(/\.SP$/i, '')
    .replace(/\.OUT$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Lookup telemetry tolerating space/hyphen/.PV variants. */
export function lookupTelemetry(
  telemetry: Record<string, TagValue>,
  tag: string,
): TagValue | undefined {
  if (telemetry[tag]) return telemetry[tag]
  const want = normalizeTagId(tag)
  if (telemetry[want]) return telemetry[want]
  for (const [k, v] of Object.entries(telemetry)) {
    if (normalizeTagId(k) === want) return v
  }
  return undefined
}

/** Lookup regulator by normalized tag. */
export function lookupRegulator(
  regulators: Record<string, RegulatorState>,
  tag: string,
): RegulatorState | undefined {
  if (regulators[tag]) return regulators[tag]
  const want = normalizeTagId(tag)
  if (regulators[want]) return regulators[want]
  for (const [k, v] of Object.entries(regulators)) {
    if (normalizeTagId(k) === want) return v
  }
  return undefined
}

interface SessionState {
  sessionId: string | null
  status: SessionStatus
  modelTime: number
  speed: number
  telemetry: Record<string, TagValue>
  alarms: ActiveAlarm[]
  regulators: Record<string, RegulatorState>
  faults: ActiveFault[]

  setSession: (id: string) => void
  setStatus: (status: SessionStatus) => void
  setModelTime: (t: number) => void
  setSpeed: (speed: number) => void
  updateTelemetry: (tags: TagValue[]) => void
  addAlarm: (alarm: ActiveAlarm) => void
  acknowledgeAlarm: (id: string) => void
  updateRegulator: (reg: RegulatorState) => void
  addFault: (fault: ActiveFault) => void
  clearFault: (id: string) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>()((set) => ({
  sessionId: null,
  status: 'idle',
  modelTime: 0,
  speed: 1,
  telemetry: {},
  alarms: [],
  regulators: {},
  faults: [],

  setSession: (id) => set({ sessionId: id }),
  setStatus: (status) => set({ status }),
  setModelTime: (t) => set({ modelTime: t }),
  setSpeed: (speed) => set({ speed }),

  updateTelemetry: (tags) =>
    set((s) => {
      const next = { ...s.telemetry }
      let alarms = s.alarms
      for (const t of tags) {
        const key = normalizeTagId(t.tag) || t.tag
        const stored: TagValue = { ...t, tag: key }
        next[key] = stored
        if (t.alarmState && t.alarmState !== 'normal') {
          const id = `tag:${key}:${t.alarmState}`
          const existing = alarms.find((a) => a.id === id)
          if (!existing) {
            alarms = [
              {
                id,
                tag: key,
                level: t.alarmState,
                message: `${key} · ${t.alarmState}`,
                timestamp: t.timestamp,
                acknowledged: false,
              },
              ...alarms,
            ].slice(0, 200)
          }
        }
      }
      return { telemetry: next, alarms }
    }),

  addAlarm: (alarm) =>
    set((s) => {
      const tag = normalizeTagId(alarm.tag) || alarm.tag
      const normalized = { ...alarm, tag }
      return {
        alarms: [normalized, ...s.alarms.filter((a) => a.id !== alarm.id)].slice(0, 200),
      }
    }),

  acknowledgeAlarm: (id) =>
    set((s) => ({
      alarms: s.alarms.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    })),

  updateRegulator: (reg) =>
    set((s) => {
      const key = normalizeTagId(reg.tag) || reg.tag
      return {
        regulators: { ...s.regulators, [key]: { ...reg, tag: key } },
      }
    }),

  addFault: (fault) =>
    set((s) => ({
      faults: [fault, ...s.faults.filter((f) => f.id !== fault.id)].slice(0, 50),
    })),

  clearFault: (id) =>
    set((s) => ({
      faults: s.faults.filter((f) => f.id !== id),
    })),

  clearSession: () =>
    set({
      sessionId: null,
      status: 'idle',
      modelTime: 0,
      telemetry: {},
      alarms: [],
      regulators: {},
      faults: [],
    }),
}))
