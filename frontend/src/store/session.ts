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

interface SessionState {
  sessionId: string | null
  status: SessionStatus
  modelTime: number
  speed: number
  telemetry: Record<string, TagValue>
  alarms: ActiveAlarm[]
  regulators: Record<string, RegulatorState>

  setSession: (id: string) => void
  setStatus: (status: SessionStatus) => void
  setModelTime: (t: number) => void
  setSpeed: (speed: number) => void
  updateTelemetry: (tags: TagValue[]) => void
  addAlarm: (alarm: ActiveAlarm) => void
  acknowledgeAlarm: (id: string) => void
  updateRegulator: (reg: RegulatorState) => void
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

  setSession: (id) => set({ sessionId: id }),
  setStatus: (status) => set({ status }),
  setModelTime: (t) => set({ modelTime: t }),
  setSpeed: (speed) => set({ speed }),

  updateTelemetry: (tags) =>
    set((s) => {
      const next = { ...s.telemetry }
      for (const t of tags) next[t.tag] = t
      return { telemetry: next }
    }),

  addAlarm: (alarm) =>
    set((s) => ({
      alarms: [alarm, ...s.alarms.filter((a) => a.id !== alarm.id)].slice(0, 200),
    })),

  acknowledgeAlarm: (id) =>
    set((s) => ({
      alarms: s.alarms.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    })),

  updateRegulator: (reg) =>
    set((s) => ({
      regulators: { ...s.regulators, [reg.tag]: reg },
    })),

  clearSession: () =>
    set({
      sessionId: null,
      status: 'idle',
      modelTime: 0,
      telemetry: {},
      alarms: [],
      regulators: {},
    }),
}))
