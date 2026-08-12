import { describe, it, expect, beforeEach } from 'vitest'
import {
  useSessionStore,
  normalizeTagId,
  lookupTelemetry,
  type TagValue,
  type ActiveAlarm,
  type RegulatorState,
} from './session'

function reset() {
  useSessionStore.getState().clearSession()
}

const tag: TagValue = { tag: 'TI 1', value: 100, unit: '°C', alarmState: 'normal', timestamp: 1 }
const alarm: ActiveAlarm = {
  id: 'a1',
  tag: 'TI 1',
  level: 'H',
  message: 'high',
  timestamp: 1,
  acknowledged: false,
}
const reg: RegulatorState = { tag: 'TRC 1', mode: 'auto', pv: 1, sp: 2, out: 3 }

describe('normalizeTagId', () => {
  it('canonicalizes hyphen and .PV variants to space form', () => {
    expect(normalizeTagId('PRSA-204')).toBe('PRSA 204')
    expect(normalizeTagId('PRSA_204.PV')).toBe('PRSA 204')
    expect(normalizeTagId('LRCA 602')).toBe('LRCA 602')
  })
})

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

  it('updates telemetry keyed by normalized tag', () => {
    useSessionStore.getState().updateTelemetry([{ ...tag, tag: 'TI-1' }])
    expect(useSessionStore.getState().telemetry['TI 1']?.value).toBe(100)
    expect(lookupTelemetry(useSessionStore.getState().telemetry, 'TI-1')?.value).toBe(100)
  })

  it('updates telemetry without synthesizing phantom alarm ids', () => {
    useSessionStore.getState().updateTelemetry([{ ...tag, alarmState: 'H', timestamp: 42 }])
    expect(useSessionStore.getState().telemetry['TI 1']?.alarmState).toBe('H')
    expect(useSessionStore.getState().alarms).toHaveLength(0)
  })

  it('adds alarms only via dedicated alarm events', () => {
    useSessionStore.getState().updateTelemetry([{ ...tag, alarmState: 'H', timestamp: 42 }])
    useSessionStore.getState().addAlarm({
      id: 'alarm-uuid-1',
      tag: 'TI-1',
      level: 'H',
      message: 'TI 1 · H',
      timestamp: 42,
      acknowledged: false,
    })
    const alarms = useSessionStore.getState().alarms
    expect(alarms).toHaveLength(1)
    expect(alarms[0]?.id).toBe('alarm-uuid-1')
    expect(alarms[0]?.tag).toBe('TI 1')
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
    expect(useSessionStore.getState().regulators['TRC 1']?.mode).toBe('auto')
  })

  it('tracks faults', () => {
    useSessionStore.getState().addFault({
      id: 'f1',
      faultId: 'FLT-K1-PRESSURE-HIGH',
      message: 'Pressure high',
      timestamp: 1,
    })
    expect(useSessionStore.getState().faults).toHaveLength(1)
    useSessionStore.getState().clearFault('f1')
    expect(useSessionStore.getState().faults).toHaveLength(0)
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
