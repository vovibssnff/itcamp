#!/usr/bin/env bash
# Генерация Python-стабов из proto.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/src/sim_engine/api/generated"
mkdir -p "$OUT"

if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
else
  PYTHON="${PYTHON:-python3}"
fi

"$PYTHON" -m grpc_tools.protoc \
  -I "$ROOT/proto" \
  --python_out="$OUT" \
  --grpc_python_out="$OUT" \
  "$ROOT/proto/ktk/sim/v1/model_api.proto"
find "$OUT" -type d -exec touch {}/__init__.py \;
echo "Стабы сгенерированы в $OUT"
