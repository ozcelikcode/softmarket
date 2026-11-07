#!/usr/bin/env bash
# Read-only SQLite backup; all Payload writes and uploads stay in a private temporary directory.
# Requires a production build: NEXT_DIST_DIR=.next-prod pnpm build
set +x # Do not expose credentials even when invoked with bash -x / inherited xtrace.
set -euo pipefail
set -m # Each owned background job gets its own process group.
umask 077
cd "$(dirname "$0")/.."
if [[ "${E2E_ISOLATED_PORT:-3400}" != 3400 ]]; then
  echo 'Isolated E2E only permits port 3400.' >&2
  exit 1
fi
if [[ -z "${E2E_ADMIN_EMAIL:-}" || -z "${E2E_ADMIN_PASSWORD:-}" ]]; then
  echo 'Run pnpm test:e2e:isolated to generate temporary credentials.' >&2
  exit 1
fi
TEMP_ROOT="$(node -e 'console.log(require("node:fs").realpathSync(require("node:os").tmpdir()))')"
DIR="$(mktemp -d "$TEMP_ROOT/softmarket-e2e-isolated.XXXXXX")"
CHILD=''
cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if [[ -n "$CHILD" ]]; then
    kill -TERM -- "-$CHILD" 2>/dev/null || true
    for ((attempt=0; attempt<50; attempt++)); do
      if ! kill -0 -- "-$CHILD" 2>/dev/null; then break; fi
      sleep 0.1
    done
    kill -KILL -- "-$CHILD" 2>/dev/null || true
    wait "$CHILD" 2>/dev/null || true
  fi
  # DIR is created above, never taken from an environment variable or glob expansion.
  if [[ "$DIR" == "$TEMP_ROOT"/softmarket-e2e-isolated.?????? && -d "$DIR" && ! -L "$DIR" ]]; then
    rm -rf -- "$DIR"
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir "$DIR/uploads"
printf '%s\n' 'softmarket isolated e2e' > "$DIR/.e2e-isolated"
# Bind arguments through Python's API: sqlite CLI .backup quoting breaks on spaces/apostrophes.
python3 - "${E2E_SOURCE_DB:-data/softmarket.db}" "$DIR/db.sqlite" <<'PY'
import pathlib, sqlite3, sys
source = pathlib.Path(sys.argv[1]).resolve(strict=True)
with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as src:
    with sqlite3.connect(sys.argv[2]) as dst:
        src.backup(dst)
PY
export E2E_ISOLATED=1 E2E_ISOLATED_DIR="$DIR"
export DATABASE_URI="$(node -e 'console.log(require("node:url").pathToFileURL(require("node:path").join(process.argv[1], "db.sqlite")).href)' "$DIR")"
export UPLOADS_DIR="$DIR/uploads" NEXT_DIST_DIR=.next-prod
export PAYLOAD_CONFIG_PATH="$PWD/src/payload.config.ts"
export PAYLOAD_SECRET="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))')"
# Never use inherited live SMTP credentials for a copied database.
export SMTP_HOST='' SMTP_FROM=''
# Avoid a package-manager wrapper detaching its children into additional process groups.
node --import tsx scripts/e2e-seed-admin.ts &
CHILD=$!
wait "$CHILD"
CHILD=''
# Use the installed shim: it execs Node and preserves pnpm's required NODE_PATH.
./node_modules/.bin/next start --hostname 127.0.0.1 --port 3400 &
CHILD=$!
wait "$CHILD"
