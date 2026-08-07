#!/usr/bin/env bash
# Генерация Python-стабов из proto.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/src/ai_service/api/generated"
mkdir -p "$OUT"
python -m grpc_tools.protoc \
  -I "$ROOT/proto" \
  --python_out="$OUT" \
  --grpc_python_out="$OUT" \
  "$ROOT/proto/ktk/ai/v1/ai_service.proto"
find "$OUT" -type d -exec touch {}/__init__.py \;
echo "Стабы сгенерированы в $OUT"
