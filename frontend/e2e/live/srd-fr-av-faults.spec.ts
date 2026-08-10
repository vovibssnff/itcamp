import { test, expect } from '@playwright/test'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  apiImportComponents,
  apiImportFaults,
  apiImportScenario,
  apiImportTemplate,
  apiCreateSession,
  apiFindOperatorId,
  apiSessionAction,
  apiSessionReplay,
  apiToken,
  fixturesDir,
  SIM_FAULTS,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/**
 * FR-AV-01..05 — parameterized fault scenarios.
 *
 * Fault ids must exist in the sim-worker catalog
 * (`services/python/sim-engine/data/faults_catalog.json`); unknown ids are
 * rejected with 404 and the fault silently never fires.
 * One shared instructor token for the file to stay under gw rate limits.
 */
const CASES = [
  { id: 'FR-AV-01', name: 'K-1 pressure high', faultId: SIM_FAULTS.k1PressureHigh },
  { id: 'FR-AV-02', name: 'K-1 level low', faultId: SIM_FAULTS.k1LevelLow },
  { id: 'FR-AV-03', name: 'feed flow low', faultId: SIM_FAULTS.feedFlowLow },
  { id: 'FR-AV-04', name: 'P-3 COT high', faultId: SIM_FAULTS.p3CotHigh },
  { id: 'FR-AV-05', name: 'instrument air loss', faultId: SIM_FAULTS.iaPressureLow },
] as const

const TRIGGER_AT = 8

test.describe('SRD FR-AV parameterized faults (live)', () => {
  let token = ''
  let templateId = ''
  let operatorId = ''

  test.beforeAll(async () => {
    token = await apiToken('instructor')
    await apiImportComponents(token)
    await apiImportFaults(token)
    const tpl = await apiImportTemplate(token, join(fixturesDir(), 'template.min.json'))
    templateId = tpl.id
    operatorId = await apiFindOperatorId(token)
  })

  for (const c of CASES) {
    test(`${c.id}: ${c.name} fault fires in a running session`, async () => {
      test.setTimeout(180_000)
      const scenarioTpl = JSON.parse(
        readFileSync(join(fixturesDir(), 'scenario.min.json'), 'utf8'),
      ) as {
        scenarios: Array<{
          id?: string
          template_id: string
          name: string
          faults: Array<{ fault_id: string; trigger?: { type?: string; at_model_time?: number } }>
        }>
      }
      const scenario = scenarioTpl.scenarios[0]!
      scenario.id = `sc-${c.id.toLowerCase()}-${Date.now().toString(36)}`
      scenario.template_id = templateId
      scenario.name = `E2E ${c.id} ${Date.now().toString(36)}`
      scenario.faults[0]!.fault_id = c.faultId
      scenario.faults[0]!.trigger = { type: 'time', at_model_time: TRIGGER_AT }

      const spath = join(mkdtempSync(join(tmpdir(), 'ktk-av-sc-')), 'scenario.json')
      writeFileSync(spath, JSON.stringify(scenarioTpl))
      const sc = await apiImportScenario(token, templateId, {
        name: scenario.name,
        atModelTime: TRIGGER_AT,
        file: spath,
      })

      const session = await apiCreateSession(token, {
        templateId,
        scenarioId: sc.id,
        operatorId,
        mode: 'training',
      })
      await apiSessionAction(token, session.id, 'start')

      try {
        await expect
          .poll(
            async () =>
              (await apiSessionReplay(token, session.id)).faults?.map((f) => f.fault_id) ?? [],
            { timeout: 90_000, intervals: [2000] },
          )
          .toContain(c.faultId)

        const replay = await apiSessionReplay(token, session.id)
        const injected = replay.faults!.find((f) => f.fault_id === c.faultId)!
        expect(injected.model_time).toBeGreaterThanOrEqual(TRIGGER_AT)
      } finally {
        await apiSessionAction(token, session.id, 'stop').catch(() => undefined)
      }
    })
  }
})
