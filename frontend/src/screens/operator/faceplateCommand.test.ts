import { describe, expect, it } from 'vitest'
import { routeFaceplateCommand } from './faceplateCommand'

describe('routeFaceplateCommand', () => {
  it('returns null when tag is missing', () => {
    expect(routeFaceplateCommand('actuator', '', 1)).toBeNull()
  })

  it('routes actuators to HTTP only (no WS duplicate)', () => {
    expect(routeFaceplateCommand('actuator', 'PUMP-1', 1)).toEqual({
      channel: 'http_actuator',
      tag: 'PUMP-1',
      value: 1,
    })
  })

  it('routes regulator setpoint to WS SET_SP shape', () => {
    expect(routeFaceplateCommand('regulator_sp', 'FRC-408', 55)).toEqual({
      channel: 'ws',
      message: { type: 'regulator_sp', tag: 'FRC-408', sp: 55 },
    })
  })

  it('routes regulator output to WS SET_OUT shape', () => {
    expect(routeFaceplateCommand('regulator_out', 'TRC-3', 30)).toEqual({
      channel: 'ws',
      message: { type: 'regulator_out', tag: 'TRC-3', out: 30 },
    })
  })

  it('routes regulator mode to WS without also emitting actuator HTTP', () => {
    expect(routeFaceplateCommand('regulator_mode', 'LRCA-641', 1)).toEqual({
      channel: 'ws',
      message: { type: 'regulator_mode', tag: 'LRCA-641', mode: 'auto' },
    })
    expect(routeFaceplateCommand('regulator_mode', 'LRCA-641', 0)).toEqual({
      channel: 'ws',
      message: { type: 'regulator_mode', tag: 'LRCA-641', mode: 'manual' },
    })
  })
})
