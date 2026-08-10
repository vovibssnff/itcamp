# Live e2e ↔ SRD mapping

IDs below are **SRD §8 TEST-*** (and related FR/MODE), not the mock Playwright labels in `frontend/e2e/*.spec.ts`.

Status is the result of the last full local run. Last run: **21/21 passed, 1 skipped** (two consecutive runs, 2026-08-11).

| SRD / docs ID                  | Spec file                          | Status      | Notes                                                                    |
| ------------------------------ | ---------------------------------- | ----------- | ------------------------------------------------------------------------ |
| TEST-11, AUTH, E2E-001/002/007 | `srd-test-11-auth-rbac.spec.ts`    | pass        | Operator + instructor/admin MFA; RBAC redirects                          |
| TEST-04, FR-TMPL-*             | `srd-test-04-templates.spec.ts`    | pass        | Import → list → copy → validate → delete                                 |
| TEST-01, FR-CNST-*             | `srd-test-01-constructor.spec.ts`  | pass        | ≥10-node fixture import → validate → save → list                         |
| TEST-02 (subset)               | `srd-test-02-scenario-run.spec.ts` | pass        | Fault fires in replay; status is exactly `running`                       |
| MODE-TRAIN, E2E-004            | `srd-sess-training.spec.ts`        | pass        | Instructor start → operator training → finish/stop                       |
| TEST-03, FR-SESS-06            | `srd-test-03-observe.spec.ts`      | pass        | Two contexts; observe RO                                                 |
| E2E-003                        | `srd-e2e-003-import-chain.spec.ts` | pass        | Import chain → session start                                             |
| FR-SESS-08 exam                | `srd-exam.spec.ts`                 | pass        | Exam mode UI; finish path                                                |
| TEST-09                        | `srd-test-09-snapshot.spec.ts`     | pass        | Checkpoint → restore → still running                                     |
| FR-ASSESS-06/07, E2E-009       | `srd-report.spec.ts`               | pass        | Report create → queued → report route                                    |
| TEST-10                        | `srd-test-10-demo-path.spec.ts`    | pass        | Serial epic; import → train → observe → exam → report                    |
| TEST-05, FR-AI-*               | `srd-test-05-ai.spec.ts`           | pass / skip | AI panel in training; Adaptive skipped (mock-only, no `/api/ai/*` on gw) |
| Admin matrix                   | `srd-admin.spec.ts`                | pass        | LDAP notice + no create/edit/delete controls                             |
| FR-AV-01..05                   | `srd-fr-av-faults.spec.ts`         | pass        | Real sim fault ids; each fault verified via assessment replay            |

## Out of Playwright live

| SRD                       | Where instead                 |
| ------------------------- | ----------------------------- |
| TEST-06 (50 sessions)     | k6/locust                     |
| TEST-07 (failover)        | compose/k8s chaos             |
| TEST-08 (HMAC/rate-limit) | `autotests` + security review |

## Run

See [README.md](./README.md).
