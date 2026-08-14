import type { ClientMessage } from '@/ws/types'

/**
 * Routes faceplate commands onto a single authoritative channel.
 * Actuators must go HTTP-only (orchestrator journals + assesses once).
 * Regulators stay on WS (typed SET_SP / SET_OUT / SET_MODE).
 * Never send the same command on both channels — that double-fires
 * HandleActuator / assessment events and advances model time twice.
 */
export type FaceplateWsMessage = Extract<
  ClientMessage,
  { type: 'regulator_sp' | 'regulator_out' | 'regulator_mode' }
>

export type FaceplateRoute =
  | { channel: 'ws'; message: FaceplateWsMessage }
  | { channel: 'http_actuator'; tag: string; value: number }

export function routeFaceplateCommand(
  type: string,
  tag: string,
  value: number,
): FaceplateRoute | null {
  if (!tag) return null
  if (type === 'regulator_sp') {
    return { channel: 'ws', message: { type: 'regulator_sp', tag, sp: value } }
  }
  if (type === 'regulator_out') {
    return { channel: 'ws', message: { type: 'regulator_out', tag, out: value } }
  }
  if (type === 'regulator_mode') {
    return {
      channel: 'ws',
      message: { type: 'regulator_mode', tag, mode: value === 1 ? 'auto' : 'manual' },
    }
  }
  // actuator (and any other faceplate write)
  return { channel: 'http_actuator', tag, value }
}
