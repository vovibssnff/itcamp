import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore, type TagValue, type ActiveAlarm, type RegulatorState } from './session'

function reset() {
  useSessionStore.getState().clearSession()
}

const tag: TagValue = { tag: 'TI-1', value: 100, unit: '°C', alarmState: 'normal', timestamp: 1 }
const alarm: ActiveAlarm = {
  id: 'a1',
  tag: 'TI-1',
  level: 'H',
  message: 'high',
  timestamp: 1,
  acknowledged: false,
}
const reg: RegulatorState = { tag: 'TRC-1', mode: 'auto', pv: 1, sp: 2, out: 3 }

describe('sessionStore', () => {
  beforeEach(reset)

  it('sets session and status', () => {
    const s = useSessionStore.getState()
    s.setSession('sess-1')
    s.setStatus('running')
    const state = useSessionStore.getState()
    expect(state.sessionId).toBe('sess-1')
    expect(state.status).toBe('running')
  })

  it('updates telemetry keyed by tag', () => {
    useSessionStore.getState().updateTelemetry([tag])
    expect(useSessionStore.getState().telemetry['TI-1']?.value).toBe(100)
  })

  it('adds and acknowledges alarms, dedups by id', () => {
    const s = useSessionStore.getState()
    s.addAlarm(alarm)
    s.addAlarm(alarm)
    expect(useSessionStore.getState().alarms).toHaveLength(1)
    s.acknowledgeAlarm('a1')
    expect(useSessionStore.getState().alarms[0]?.acknowledged).toBe(true)
  })

  it('updates regulators', () => {
    useSessionStore.getState().updateRegulator(reg)
    expect(useSessionStore.getState().regulators['TRC-1']?.mode).toBe('auto')
  })

  it('sets model time and speed', () => {
    const s = useSessionStore.getState()
    s.setModelTime(42)
    s.setSpeed(5)
    const state = useSessionStore.getState()
    expect(state.modelTime).toBe(42)
    expect(state.speed).toBe(5)
  })

  it('clearSession resets state', () => {
    const s = useSessionStore.getState()
    s.setSession('x')
    s.updateTelemetry([tag])
    s.clearSession()
    const state = useSessionStore.getState()
    expect(state.sessionId).toBeNull()
    expect(Object.keys(state.telemetry)).toHaveLength(0)
  })
})
