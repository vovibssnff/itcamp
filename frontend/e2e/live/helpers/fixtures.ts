import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fixturesDir } from './paths'

/**
 * Fault ids the sim-worker catalog actually knows.
 * Catalog ramp_s (overridable via scenario params.ramp_seconds → sim ramp_s):
 *   iaPressureLow  → 0s   (no H/L tag alarm in current ELOU model)
 *   p3CotHigh      → 5s   (TR 55-9 H≈63s model time at 1×)
 *   feedFlowLow    → 180s
 *   k1PressureHigh → 300s catalog; e2e fixture overrides to 30s
 *   k1LevelLow     → 400s
 */
export const SIM_FAULTS = {
  iaPressureLow: 'FLT-IA-PRESSURE-LOW',
  p3CotHigh: 'FLT-P3-COT-HIGH',
  feedFlowLow: 'FLT-FEED-FLOW-LOW',
  k1PressureHigh: 'FLT-K1-PRESSURE-HIGH',
  k1LevelLow: 'FLT-K1-LEVEL-LOW',
} as const

/** Pure filesystem helper — writes a temp template JSON with a unique name. */
export function writeBoundTemplateFixture(opts?: { file?: string; name?: string }): {
  path: string
  name: string
} {
  const fx = fixturesDir()
  const file = opts?.file ?? join(fx, 'template.min.json')
  const tpl = JSON.parse(readFileSync(file, 'utf8')) as { name: string }
  const name = opts?.name ?? `E2E Facility ${Date.now().toString(36)}`
  tpl.name = name
  const tmp = mkdtempSync(join(tmpdir(), 'ktk-e2e-tpl-'))
  const path = join(tmp, 'template.json')
  writeFileSync(path, JSON.stringify(tpl))
  return { path, name }
}

/** Pure filesystem helper — binds template_id into a scenario fixture. */
export function writeBoundScenarioFixture(
  templateId: string,
  opts?: {
    name?: string
    atModelTime?: number
    type?: string
    faultId?: string
    file?: string
  },
): { path: string; name: string } {
  const fx = fixturesDir()
  const file = opts?.file ?? join(fx, 'scenario.min.json')
  const tpl = JSON.parse(readFileSync(file, 'utf8')) as {
    scenarios: Array<{
      id?: string
      template_id: string
      name: string
      type?: string
      faults?: Array<{
        fault_id?: string
        trigger?: { type?: string; at_model_time?: number }
      }>
    }>
  }
  const name = opts?.name ?? `E2E Scenario ${Date.now().toString(36)}`
  tpl.scenarios[0]!.id = `sc-e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  tpl.scenarios[0]!.template_id = templateId
  tpl.scenarios[0]!.name = name
  if (opts?.type) tpl.scenarios[0]!.type = opts.type
  if (opts?.atModelTime != null && tpl.scenarios[0]!.faults?.[0]?.trigger) {
    tpl.scenarios[0]!.faults[0]!.trigger!.at_model_time = opts.atModelTime
  }
  if (opts?.faultId && tpl.scenarios[0]!.faults?.[0]) {
    tpl.scenarios[0]!.faults[0]!.fault_id = opts.faultId
  }
  const tmp = mkdtempSync(join(tmpdir(), 'ktk-e2e-sc-'))
  const path = join(tmp, 'scenario.json')
  writeFileSync(path, JSON.stringify(tpl))
  return { path, name }
}
