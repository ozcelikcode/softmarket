#!/usr/bin/env bash
set -euo pipefail
: "${DEPLOY_HOST:?Set DEPLOY_HOST to the SSH target}"
root="$(cd "$(dirname "$0")/.." && pwd)"
release="$(date -u +%Y%m%d%H%M%S)-$$"
ssh "$DEPLOY_HOST" "mkdir -p /opt/softmarket/releases/$release"
rsync -az --exclude '.git' --exclude node_modules --exclude .next --exclude .env --exclude data --exclude uploads --exclude backups "$root/" "$DEPLOY_HOST:/opt/softmarket/releases/$release/"
ssh "$DEPLOY_HOST" bash -s -- "$release" <<'REMOTE'
set -euo pipefail
base=/opt/softmarket
release="$base/releases/$1"
previous="$(readlink -f "$base/current" || true)"
ln -s "$base/shared/data" "$release/data"
ln -s "$base/shared/uploads" "$release/uploads"
cd "$release"
pnpm install --frozen-lockfile
set -a
source /etc/softmarket.env
set +a
pnpm build
sudo systemctl stop softmarket
rollback() { if [[ -n "$previous" && -d "$previous" ]]; then ln -sfn "$previous" "$base/current"; sudo systemctl restart softmarket; fi; }
trap rollback ERR
pnpm migrate
ln -sfn "$release" "$base/current"
sudo systemctl restart softmarket
sudo systemctl is-active --quiet softmarket
trap - ERR
REMOTE
