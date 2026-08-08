#!/usr/bin/env bash
# Bootstrap Deckhouse EE on VK Cloud.
# Prerequisites: Docker, config.yml (from config.yml.example), SSH key, EE license.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${CONFIG:-$ROOT/config.yml}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
INSTALL_IMAGE="${INSTALL_IMAGE:-registry.deckhouse.io/deckhouse/ee/install:stable}"
SSH_USER="${SSH_USER:-ubuntu}"

if [[ ! -f "$CONFIG" ]]; then
  echo "missing $CONFIG — copy config.yml.example and fill secrets" >&2
  exit 1
fi
if [[ ! -f "$SSH_KEY" ]]; then
  echo "missing SSH key $SSH_KEY" >&2
  exit 1
fi

mkdir -p "$ROOT/dhctl-tmp"
echo "Starting installer container ($INSTALL_IMAGE)..."
echo "Inside container run:"
echo "  dhctl bootstrap --ssh-user=$SSH_USER --ssh-agent-private-keys=/tmp/.ssh/$(basename "$SSH_KEY") --config=/config.yml"

docker run -it --pull=always \
  -v "$CONFIG:/config.yml:ro" \
  -v "$ROOT/dhctl-tmp:/tmp/dhctl" \
  -v "$(dirname "$SSH_KEY"):/tmp/.ssh:ro" \
  "$INSTALL_IMAGE" bash
