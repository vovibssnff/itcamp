import { test, expect } from '@playwright/test'
import {
  apiGetSession,
  apiSeedStack,
  apiSessionAction,
  apiSessionReplay,
  createAndOpenSession,
  loginAsInstructorLive,
  SIM_FAULTS,
  startSessionFromList,
} from './helpers'

// Note: apiGetSession is used only for the final status assertion.

test.describe.configure({ mode: 'serial' })

/** SRD TEST-02 subset — timed fault scenario run. */
test.describe('SRD TEST-02 scenario run (live)', () => {
  test('import timed-fault scenario → start → fault fires and model time advances', async ({
    page,
  }) => {
    test.setTimeout(180_000)
    const triggerAt = 10
    const seed = await apiSeedStack({
      scenarioName: `E2E Fault Run ${Date.now().toString(36)}`,
      atModelTime: triggerAt,
      start: false,
    })

    await loginAsInstructorLive(page)
    const sessionId = await createAndOpenSession(page, {
      token: seed.token,
      templateId: seed.templateId,
      scenarioId: seed.scenarioId,
    })
    await startSessionFromList(page, sessionId)

    // Poll the assessment replay — the fault record is written to the DB when fired
    // so this is the only reliable REST indicator of model-time advancement.
    // (GET /sessions/{id}.model_time always returns 0 while running; it is only
    // persisted on stop.)  The fault only fires when model_time >= triggerAt, so
    // seeing it in the replay implicitly proves the sim clock passed the trigger.
    await expect
      .poll(
        async () =>
          (await apiSessionReplay(seed.token, sessionId)).faults?.map((f) => f.fault_id) ?? [],
        { timeout: 120_000, intervals: [2000] },
      )
      .toContain(SIM_FAULTS.k1PressureHigh)

    expect((await apiGetSession(seed.token, sessionId)).status).toBe('running')

    await apiSessionAction(seed.token, sessionId, 'stop')
  })
})
