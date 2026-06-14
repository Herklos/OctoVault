#!/usr/bin/env bash
# dev-cutover.sh — wipe all OctoVault server data and restart clean.
#
# Run this once after migrating to the octospaces-sdk 0.4.x data model:
#   - _rooms → _access (space access record path changed)
#   - objindex was encrypted (delegated), now plaintext (none)
#   - pubspaces/ namespace removed
#   - Per-node access model replaces space-level public concept
#
# Old data (wrong paths + wrong encryption) is unreadable by the new
# client, so wiping is the correct dev action. NEVER run on production.
#
# Usage: bash apps/server/dev-cutover.sh [DATA_DIR]
#   DATA_DIR defaults to $STARFISH_DATA_DIR, then ./apps/server/data
#   (matching the same env var the server reads so you can't accidentally
#   wipe a different directory than the one the server is using)

set -euo pipefail

DATA_DIR="${1:-${STARFISH_DATA_DIR:-$(dirname "$0")/data}}"

echo "[dev-cutover] Targeting data dir: $DATA_DIR"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "[dev-cutover] Data dir does not exist — nothing to wipe."
  exit 0
fi

echo "[dev-cutover] WARNING: This will DELETE all sync data in $DATA_DIR"
echo "[dev-cutover] Press Ctrl-C within 5 seconds to abort..."
sleep 5

echo "[dev-cutover] Wiping $DATA_DIR ..."
rm -rf "$DATA_DIR"
mkdir -p "$DATA_DIR"

echo "[dev-cutover] Done. Start the server fresh:"
echo "  pnpm --filter @octovault/server dev"
