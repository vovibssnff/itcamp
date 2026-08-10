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
- Users:
  - `instructor` / `instructor123` (MFA)
  - `admin` / `admin123` (MFA)
  - `operator` / `operator123` (no MFA)

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

| Variable                                       | Default                         | Purpose            |
| ---------------------------------------------- | ------------------------------- | ------------------ |
| `E2E_API_BASE`                                 | `http://localhost:8088`         | REST helpers / MFA |
| `E2E_INSTRUCTOR_LOGIN` / `E2E_INSTRUCTOR_PASS` | `instructor` / `instructor123`  | Instructor         |
| `E2E_ADMIN_LOGIN` / `E2E_ADMIN_PASS`           | `admin` / `admin123`            | Admin              |
| `E2E_OPERATOR_LOGIN` / `E2E_OPERATOR_PASS`     | `operator` / `operator123`      | Operator           |
| `E2E_MFA_SECRET` / `E2E_INSTRUCTOR_MFA_SECRET` | cached `.instructor-mfa-secret` | Instructor TOTP    |
| `E2E_ADMIN_MFA_SECRET`                         | cached `.admin-mfa-secret`      | Admin TOTP         |

On first MFA login the helper enrolls and caches the secret under `e2e/live/` (gitignored).

## Harness

| Module            | Role                                                              |
| ----------------- | ----------------------------------------------------------------- |
| `helpers/auth.ts` | UI login MFA (instructor/admin), operator provision/login, logout |
| `helpers/api.ts`  | Authenticated REST seed (import, session create/start)            |
| `helpers/ui.ts`   | Ant Select, JSON import, session create/start via UI              |

Default timeout for live project: use `test.setTimeout(120_000)` (session start: `180_000`).

## Writing fault scenarios

Scenario faults must reference a `fault_id` from the **sim-worker** catalog
(`services/python/sim-engine/data/faults_catalog.json`), exposed at
`GET :8092/v1/faults`. Importing a fault into the scenario service only creates
catalog metadata — it does not teach the sim a new fault. An unknown id makes the
orchestrator log `inject fault failed … Неизвестная неисправность` and the fault
never fires, while the session keeps running normally.

Use the `SIM_FAULTS` map from `helpers/api.ts`, and assert the injection really
happened via `apiSessionReplay()` (`faults[]`) rather than checking session
status — every status value satisfies a "still alive" assertion.

## Known skips

- **Adaptive AI generate** — mock-only (`/api/ai/*` not on gw); see `srd-test-05-ai.spec.ts`.
