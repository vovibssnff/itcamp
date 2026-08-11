#!/usr/bin/env bash
# Генерация SBOM (CycloneDX JSON) для всех сервисов и фронтенда проекта.
# Требует: syft (https://github.com/anchore/syft).
#
# Использование:
#   tools/sbom/gen-sbom.sh            # сгенерировать SBOM для всех + сводку лицензий
# Результат: sbom/<name>.json + sbom/licenses-summary.md/.csv
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT/sbom"
GO_DIR="$ROOT/services/go"
PY_DIR="$ROOT/services/python"
FE_DIR="$ROOT/frontend"

mkdir -p "$OUT"

command -v syft >/dev/null 2>&1 || { echo "ERROR: syft не установлен. Установка: brew install syft"; exit 1; }

gen() { # gen <source-path> <source-name> <out-file>
  echo "==> $3"
  syft scan "$1" --source-name "$2" -o cyclonedx-json="$OUT/$3" -q
}

# Go-сервисы
for d in assessment auth constructor gw orchestrator report scenario sim-manager snapshot shared; do
  [ -f "$GO_DIR/$d/go.mod" ] && gen "$GO_DIR/$d" "ktc-$d" "go-$d.json"
done

# Python-сервисы
for d in ai sim-engine; do
  [ -f "$PY_DIR/$d/requirements.txt" ] && gen "$PY_DIR/$d" "ktc-$d" "py-$d.json"
done

# Frontend (Vite/pnpm)
if [ -d "$FE_DIR/node_modules" ]; then
  gen "$FE_DIR" "ktc-frontend" "fe-frontend.json"
  python3 "$ROOT/tools/sbom/node_licenses.py" "$FE_DIR" -o "$OUT/fe-frontend-licenses.csv"
else
  echo "==> fe-frontend: node_modules отсутствует — лицензии не определяются. Установите зависимости: cd frontend && pnpm install"
fi

# Сводка по лицензиям
python3 "$ROOT/tools/sbom/licenses_summary.py" "$OUT"

echo "Готово. Смотри $OUT/licenses-summary.md"
