#!/usr/bin/env bash
set -euo pipefail
: "${DEPLOY_HOST:?Set DEPLOY_HOST to the SSH target}"
root="$(cd "$(dirname "$0")/.." && pwd)"
release="$(date -u +%Y%m%d%H%M%S)-$$"
ssh "$DEPLOY_HOST" "mkdir -p /opt/softmarket/releases/$release"
rsync -az \
  --exclude '.git' --exclude 'node_modules/' --exclude '.pnpm-store/' --exclude '.cache/' \
  --exclude '.next/' --exclude '.next-*/' --exclude 'out/' --exclude '*.tsbuildinfo' \
  --exclude 'test-results/' --exclude 'playwright-report/' --exclude 'coverage/' \
  --exclude '.env' --exclude '.env.*' --exclude '/data/' --exclude '/uploads/' --exclude 'backups/' \
  "$root/" "$DEPLOY_HOST:/opt/softmarket/releases/$release/"
ssh "$DEPLOY_HOST" bash -s -- "$release" <<'REMOTE'
set -euo pipefail
base=/opt/softmarket
release="$base/releases/$1"
previous="$(readlink -f "$base/current" || true)"
ln -s "$base/shared/data" "$release/data"
ln -s "$base/shared/uploads" "$release/uploads"
cd "$release"
set -a
source /etc/softmarket.env
set +a
if [[ "${NEXT_DIST_DIR:-.next}" != '.next' ]]; then
  echo 'The systemd deployment expects NEXT_DIST_DIR to be unset or .next.' >&2
  exit 1
fi

build_dir="$(mktemp -d "$base/releases/.build.XXXXXX")"
trap 'rm -rf -- "$build_dir"' EXIT
install_args=(--frozen-lockfile --store-dir "$build_dir/store" --cache-dir "$build_dir/cache")
export NODE_ENV=production
rsync -a "$release/" "$build_dir/app/"
(
  cd "$build_dir/app"
  CI=true pnpm install --prod=false "${install_args[@]}"
  SOFTMARKET_READ_ONLY_RELEASE=1 pnpm build
)
# Ship the compiled output and its runtime data. The disposable build keeps
# its dev install and Webpack cache until the EXIT trap cleans it up.
rsync -a --exclude '/cache/webpack/' "$build_dir/app/.next/" "$release/.next/"
CI=true pnpm install --prod "${install_args[@]}"
rm -rf -- "$build_dir"
trap - EXIT

# Snapshot the live DB before the migration (online .backup, service still up).
# The name matches the pattern pnpm backups:prune manages.
db_uri="${DATABASE_URI:-file:./data/softmarket.db}"
if [[ "$db_uri" == file:* ]]; then
  db_path="${db_uri#file:}"
  [[ "$db_path" == /* ]] || db_path="$release/$db_path"
  if [[ -f "$db_path" ]]; then
    if [[ "$db_path" == *"'"* ]]; then echo 'Unsupported database path' >&2; exit 1; fi
    mkdir -p "$base/shared/data/backups"
    sqlite3 "$db_path" ".backup '$base/shared/data/backups/pre-deploy-$(date -u +%Y%m%d-%H%M%S).db'"
  fi
fi

sudo systemctl stop softmarket
switch_to() { ln -sfn "$1" "$base/current.tmp" && mv -Tf "$base/current.tmp" "$base/current"; }
rollback() { if [[ -n "$previous" && -d "$previous" ]]; then switch_to "$previous"; sudo systemctl restart softmarket; fi; }
trap rollback ERR
pnpm migrate
switch_to "$release"
sudo systemctl restart softmarket
sudo systemctl is-active --quiet softmarket
trap - ERR
REMOTE
