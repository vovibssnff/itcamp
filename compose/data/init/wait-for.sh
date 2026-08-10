#!/usr/bin/env bash
# Optional helper; compose inits use service healthchecks.
set -euo pipefail
host="$1"
port="$2"
timeout="${3:-60}"
i=0
while ! (echo >/dev/tcp/"$host"/"$port") 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge "$timeout" ]; then
    echo "timeout waiting for ${host}:${port}" >&2
    exit 1
  fi
  sleep 1
done
