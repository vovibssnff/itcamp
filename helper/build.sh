#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# helper/build.sh — сборка всех контейнеров стека КТК (все слои compose).
#
# Собирает Docker-образы каждого слоя без их запуска:
#   data(мигратор) → app(Go-сервисы + frontend) → ai(ai-service) → sim(sim-worker, sim-manager)
# monitoring собран из готовых образов и в build.sh не участвует.
#
# Запуск из любой директории:
#   ./helper/build.sh          # все слои
#   ./helper/build.sh app      # только слой app
#   ./helper/build.sh data ai  # несколько слоёв
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Слои с Dockerfile-ами, которые реально нужно собирать (monitoring — готовые образы).
LAYERS=(data app ai sim)

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

build_layer() {
  local layer="$1"
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  Сборка слоя: $layer"
  echo "═══════════════════════════════════════════════════════════════"
  # shellcheck disable=SC2086
  docker compose --env-file "compose/$layer/.env" -f "compose/$layer/compose.yaml" build
}

main() {
  ensure_env

  local selected=("$@")
  if [ "${#selected[@]}" -eq 0 ]; then
    selected=("${LAYERS[@]}")
  fi

  for layer in "${selected[@]}"; do
    case " ${LAYERS[*]} " in
      *" $layer "*)
        build_layer "$layer"
        ;;
      *)
        echo "⚠  неизвестный слой: $layer (ожидаются: ${LAYERS[*]})" >&2
        ;;
    esac
  done

  echo ""
  echo "✅ Сборка завершена. Для запуска всех слоёв выполните: ./helper/run.sh"
}

main "$@"
