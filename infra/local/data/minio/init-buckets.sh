#!/bin/sh
set -eu

echo "waiting for MinIO..."
i=0
until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "MinIO not ready" >&2
    exit 1
  fi
  sleep 1
done

for bucket in snapshots reports component-icons; do
  mc mb --ignore-existing "local/${bucket}"
  mc anonymous set none "local/${bucket}" >/dev/null 2>&1 || true
  echo "bucket ready: ${bucket}"
done

echo "minio-init done"
