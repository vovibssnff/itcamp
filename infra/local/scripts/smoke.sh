#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "missing .env — copy from .env.example" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

COMPOSE=(docker compose --env-file .env -f compose.yaml)

echo "== compose ps =="
"${COMPOSE[@]}" ps

echo "== Picodata SELECT 1 =="
"${COMPOSE[@]}" run --rm --no-deps --entrypoint psql \
  -e "PGPASSWORD=${PICODATA_ADMIN_PASSWORD}" \
  picodata-init \
  -h picodata -p 4327 -U admin -d postgres -c 'SELECT 1 AS ok;'

echo "== Radix (Redis) PING =="
"${COMPOSE[@]}" exec -T radix redis-cli -p 7379 ping | grep -q PONG
echo "PONG"

echo "== MinIO buckets =="
"${COMPOSE[@]}" run --rm --no-deps --entrypoint /bin/sh \
  -e "MINIO_ROOT_USER=${MINIO_ROOT_USER}" \
  -e "MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}" \
  minio-init \
  -c 'mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" && mc ls local'

echo "== NATS streams =="
"${COMPOSE[@]}" run --rm --no-deps --entrypoint /bin/sh \
  nats-init \
  -c 'nats --server=nats://nats:4222 stream ls'

echo "SMOKE OK"
