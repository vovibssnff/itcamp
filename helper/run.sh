#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# helper/run.sh — запуск (up -d) всех слоёв compose стека КТК в порядке
# зависимостей, при необходимости пересобирая образы (--build).
#
#  data(инфраструктура+сеть ktc-data) → app → ai → sim → monitoring
#
# Запуск из любой директории:
#   ./helper/run.sh              # поднять все слои (без пересборки)
#   ./helper/run.sh --build      # поднять и пересобрать образы
#   ./helper/run.sh app          # поднять только слой app
#   ./helper/run.sh data ai      # поднять несколько слоёв
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Все слои в порядке запуска.
LAYERS=(data app ai sim monitoring)

# ── Убеждаемся, что .env созданы (первичная настройка) ──────────────────────
ensure_env() {
  for layer in data app ai sim monitoring; do
    if [ ! -f "compose/$layer/.env" ]; then
      if [ -f "compose/$layer/.env.example" ]; then
        cp "compose/$layer/.env.example" "compose/$layer/.env"
        echo "ℹ  создан compose/$layer/.env из .env.example (отредактируйте секреты при необходимости)"
      else
        echo "⚠  отсутствует compose/$layer/.env и .env.example" >&2
      fi
    fi
  done
}

up_layer() {
  local layer="$1"
  local build_flag="$2"
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  Запуск слоя: $layer"
  echo "═══════════════════════════════════════════════════════════════"
  # shellcheck disable=SC2086
  docker compose --env-file "compose/$layer/.env" -f "compose/$layer/compose.yaml" up -d $build_flag
}

main() {
  ensure_env

  local selected=()
  local build_flag=""

  for arg in "$@"; do
    case "$arg" in
      --build)
        build_flag="--build"
        ;;
      data|app|ai|sim|monitoring)
        selected+=("$arg")
        ;;
      *)
        echo "⚠  неизвестный аргумент/слой: $arg (ожидаются: ${LAYERS[*]} | --build)" >&2
        exit 1
        ;;
    esac
  done

  if [ "${#selected[@]}" -eq 0 ]; then
    selected=("${LAYERS[@]}")
  fi

  for layer in "${selected[@]}"; do
    up_layer "$layer" "$build_flag"
  done

  echo ""
  echo "✅ Слои запущены. Статус:"
  docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "ktc-|ktk-" | sort || true
}

main "$@"
