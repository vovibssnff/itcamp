# Backend wiring

The SPA talks to the **API gateway** (`gw`) at `/api/v1/*`.

### Docker Compose (recommended local stack)

Frontend is part of `compose/app` (Angie serves the SPA and proxies `/api` → `gw`):

```bash
cd compose/data && cp -n .env.example .env && docker compose up -d --build
cd ../sim  && cp -n .env.example .env && docker compose up -d --build
cd ../app  && cp -n .env.example .env && docker compose up -d --build
```

| URL                   | What                 |
| --------------------- | -------------------- |
| http://localhost:8090 | Frontend SPA         |
| http://localhost:8088 | Gateway API directly |

Stub auth users: `admin/admin123`, `instructor/instructor123`, `operator/operator123`.

Build args (empty bases = same-origin `/api` via Angie proxy):

- `VITE_API_BASE_URL=`
- `VITE_WS_BASE_URL=`
- `VITE_MOCK_API=false`

### Vite hot-reload (optional, without Docker frontend)

| Env var                 | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `VITE_API_BASE_URL`     | Leave **empty** for relative REST via Vite proxy           |
| `VITE_WS_BASE_URL`      | Leave **empty** for same-origin WS via Vite proxy          |
| `VITE_DEV_PROXY_TARGET` | Vite `/api` proxy target (default `http://localhost:8088`) |
| `VITE_MOCK_API`         | `true` → MSW REST mocks + mock WebSocket                   |

```bash
cp -n .env.development.example .env.development
pnpm install && pnpm openapi:gen && pnpm dev
```

### Mock mode (no backend)

```bash
VITE_MOCK_API=true pnpm dev
```

MSW mock logins use `admin`/`admin`, `instructor`/`instructor`, `operator`/`operator`
(different from compose stub passwords above).

Mock-only endpoints (hidden when `VITE_MOCK_API=false`):

- `POST /api/ai/chat`
- `POST /api/scenarios/ai-generate`
- scenario moderation `publish\|archive\|unpublish`
- CSV export `/api/assessment/reports/export`
- `/api/assignments*`

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
