import { describe, it, expect } from 'vitest'
import { generateTelemetryTick, resetTelemetry, TAG_CONFIG } from './telemetry'

describe('telemetry generator', () => {
  it('produces a value for every configured tag', () => {
    const tick = generateTelemetryTick()
    expect(tick).toHaveLength(TAG_CONFIG.length)
    for (const t of tick) {
      expect(typeof t.value).toBe('number')
      expect(t.unit).toBeTruthy()
      expect(['normal', 'L', 'LL', 'H', 'HH']).toContain(t.alarmState)
    }
  })

  it('resets drift back to nominal', () => {
    // Drift a lot
    for (let i = 0; i < 50; i++) generateTelemetryTick(5)
    resetTelemetry()
    const tick = generateTelemetryTick(0)
    for (const t of tick) {
      const cfg = TAG_CONFIG.find((c) => c.tag === t.tag)!
      // With deltaT 0 and reset state, value should be near nominal
      expect(Math.abs(t.value - cfg.nominal)).toBeLessThan(cfg.noise * 2 + 1)
    }
  })

  it('assigns timestamps', () => {
    const before = Date.now()
    const tick = generateTelemetryTick()
    expect(tick[0]!.timestamp).toBeGreaterThanOrEqual(before)
  })
})
