#!/bin/sh
set -eu

NATS_URL="${NATS_URL:-nats://nats:4222}"

echo "waiting for NATS at ${NATS_URL}..."
i=0
until nats --server="$NATS_URL" account info >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "NATS not ready" >&2
    exit 1
  fi
  sleep 1
done

# Work-queue style subjects for async tasks; limits for event streams.
create_wq() {
  name="$1"
  subjects="$2"
  if nats --server="$NATS_URL" stream info "$name" >/dev/null 2>&1; then
    echo "stream exists: $name"
  else
    nats --server="$NATS_URL" stream add "$name" \
      --subjects="$subjects" \
      --retention=workq \
      --storage=file \
      --replicas=1 \
      --defaults
    echo "stream created: $name"
  fi
}

create_limits() {
  name="$1"
  subjects="$2"
  if nats --server="$NATS_URL" stream info "$name" >/dev/null 2>&1; then
    echo "stream exists: $name"
  else
    nats --server="$NATS_URL" stream add "$name" \
      --subjects="$subjects" \
      --retention=limits \
      --storage=file \
      --replicas=1 \
      --defaults
    echo "stream created: $name"
  fi
}

create_wq REPORT_TASKS "report.tasks"
create_wq AI_TASKS "ai.tasks"
create_limits SESSION_EVENTS "session.events"
create_limits ASSESSMENT_EVENTS "assessment.events"

nats --server="$NATS_URL" stream ls
echo "nats-init done"
