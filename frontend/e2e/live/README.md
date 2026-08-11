# Live Playwright (compose stack)

These specs hit the **real** compose stack — not MSW. Mapping: [SCENARIOS.md](./SCENARIOS.md).

## Prerequisites

From the **repo root** (`~/Projects/itcamp`):

```bash
docker compose -f compose/data/compose.yaml up -d
docker compose -f compose/sim/compose.yaml up -d --build
docker compose -f compose/app/compose.yaml up -d --build
```

- UI: http://localhost:8090
- API: http://localhost:8088
- Users (password only):
  - `instructor` / `instructor123`
  - `admin` / `admin123`
  - `operator` / `operator123`

`pnpm` is optional — use the local Playwright binary if needed.

## Run

```bash
cd frontend
unset PLAYWRIGHT_BROWSERS_PATH   # if Cursor sandbox pointed browsers elsewhere
E2E_LIVE=1 ./node_modules/.bin/playwright test --project=live
# or: E2E_LIVE=1 pnpm e2e:live
```

Single file:

```bash
E2E_LIVE=1 ./node_modules/.bin/playwright test --project=live e2e/live/srd-test-11-auth-rbac.spec.ts
```

Optional env:

| Variable                                       | Default                        | Purpose      |
| ---------------------------------------------- | ------------------------------ | ------------ |
| `E2E_API_BASE`                                 | `http://localhost:8088`        | REST helpers |
| `E2E_INSTRUCTOR_LOGIN` / `E2E_INSTRUCTOR_PASS` | `instructor` / `instructor123` | Instructor   |
| `E2E_ADMIN_LOGIN` / `E2E_ADMIN_PASS`           | `admin` / `admin123`           | Admin        |
| `E2E_OPERATOR_LOGIN` / `E2E_OPERATOR_PASS`     | `operator` / `operator123`     | Operator     |

## Harness

| Module                | Role                                                                  |
| --------------------- | --------------------------------------------------------------------- |
| `helpers/auth.ts`     | UI password login (instructor/admin/operator), operator provision     |
| `helpers/fixtures.ts` | Bound template/scenario JSON writers + `SIM_FAULTS` (filesystem only) |
| `helpers/ui.ts`       | Browser-only seed (`uiSeedStack`), session start/stop, `waitForAlarm` |

The live suite is **UI-only**: specs must not call backend REST from Node
(`apiFetch` / `apiToken` / `apiSeedStack` were removed). Auth helpers may still
use `fetch` for stub-operator provisioning.

Default timeout for live project: use `test.setTimeout(180_000)` (full UI seed
is slower than the old REST seed; session start often needs `240_000`).

## Writing fault scenarios

Scenario faults must reference a `fault_id` from the **sim-worker** catalog
(`services/python/sim-engine/data/faults_catalog.json`), exposed at
`GET :8092/v1/faults`. Importing a fault into the scenario service only creates
catalog metadata — it does not teach the sim a new fault. An unknown id makes the
orchestrator log `inject fault failed … Неизвестная неисправность` and the fault
never fires, while the session keeps running normally.

Use the `SIM_FAULTS` map from `helpers/fixtures.ts`, and assert the injection
visibly via `waitForAlarm()` (`AlarmBanner` / `alarm-count`) after the scenario
trigger time — not via REST replay.

## Known skips

- **Adaptive AI generate** — mock-only (`/api/ai/*` not on gw); see `srd-test-05-ai.spec.ts`.
