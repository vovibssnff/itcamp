# KTK Frontend

React + Vite SPA for the KTK training complex.

## Backend wiring

The app talks to the **API gateway** (`gw`) at `/api/v1/*` via a typed
`openapi-fetch` client (`src/api/client.ts` + domain modules in `src/api/`).

| Env var             | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `VITE_API_BASE_URL` | Gateway origin (dev: `http://localhost:8088`) |
| `VITE_WS_BASE_URL`  | WebSocket origin (dev: `ws://localhost:8088`) |
| `VITE_MOCK_API`     | `true` → MSW REST mocks + mock WebSocket      |

### Real gateway (docker-compose)

```bash
cp .env.development.example .env.development
# defaults already point at localhost:8088
pnpm dev
```

Vite proxies `/api` to `VITE_API_BASE_URL` when set.

### Mock mode (no backend)

```bash
# Playwright E2E always uses mocks. For local UI:
VITE_MOCK_API=true pnpm dev
# or: cp .env.mock .env.development.local
```

Mock-only endpoints (not in gateway OpenAPI) stay under MSW:

- `POST /api/ai/chat`
- `POST /api/scenarios/ai-generate`
- scenario moderation `publish|archive|unpublish`
- CSV export `/api/assessment/reports/export`

### Regenerate OpenAPI types

```bash
pnpm openapi:gen
```

Reads specs from `services/go/*/api/openapi.yaml`.

## Scripts

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm e2e
```
