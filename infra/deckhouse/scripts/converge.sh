#!/usr/bin/env bash
# Converge cluster config after editing config.yml / resources.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${CONFIG:-$ROOT/config.yml}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
INSTALL_IMAGE="${INSTALL_IMAGE:-registry.deckhouse.io/deckhouse/ee/install:stable}"
SSH_USER="${SSH_USER:-ubuntu}"
SSH_HOST="${SSH_HOST:?set SSH_HOST to master floating IP}"

docker run -it --pull=always \
  -v "$CONFIG:/config.yml:ro" \
  -v "$ROOT/dhctl-tmp:/tmp/dhctl" \
  -v "$(dirname "$SSH_KEY"):/tmp/.ssh:ro" \
  "$INSTALL_IMAGE" \
  dhctl converge \
    --ssh-user="$SSH_USER" \
    --ssh-host="$SSH_HOST" \
    --ssh-agent-private-keys="/tmp/.ssh/$(basename "$SSH_KEY")" \
    --config=/config.yml
