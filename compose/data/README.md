# Local data-plane (KTК)

PostgreSQL (stand-in for Picodata CE) + Redis (stand-in for commercial **Radix**) + MinIO + NATS JetStream.

## Quick start

```bash
cd compose/data
cp .env.example .env
make pull
make up
make smoke
```

## Endpoints (host)

| Port | Service | URL / DSN |
|------|---------|-----------|
| 5432 | Picodata PG-wire | `postgres://admin:<pass>@127.0.0.1:5432/postgres` |
| 7379 | Radix/Redis | `redis://127.0.0.1:7379/0` |
| 9000 | MinIO S3 | `http://127.0.0.1:9000` |
| 9001 | MinIO Console | `http://127.0.0.1:9001` |
| 4222 | NATS | `nats://127.0.0.1:4222` |
| 8222 | NATS monitor | `http://127.0.0.1:8222` |

From other containers on network `ktc-data`:

```
PICODATA_DSN=postgres://admin:<pass>@picodata:4327/postgres
RADIX_URL=redis://radix:7379/0
S3_ENDPOINT=http://minio:9000
NATS_URL=nats://nats:4222
```

## Images

| Component | Image |
|-----------|--------|
| PostgreSQL (Picodata stand-in) | `postgres:16-alpine` (compat-имя `picodata`, порт 4327) |
| Cache | `redis:7.4-alpine` on port **7379** (Radix-compatible address; swap to Radix when licensed) |
| MinIO | `minio/minio:RELEASE.2025-04-22T22-12-26Z` |
| NATS | `nats:2.11-alpine` |
| migrator | строится из `tools/migrator` |

## Buckets / streams

- MinIO: `snapshots`, `reports`, `component-icons`
- NATS: `REPORT_TASKS`, `AI_TASKS`, `SESSION_EVENTS`, `ASSESSMENT_EVENTS`

## Notes

- Radix is a **commercial** Picodata plugin. Local CE uses Redis with the same DNS name `radix` and port `7379`.
- Picodata image runs as uid 1000; compose sets `user: "0:0"` so the named volume is writable locally.
- Admin password: `PICODATA_ADMIN_PASSWORD` in `.env` (default in example: `T0psecret`).
- `make reset-data` removes volumes.
