#!/usr/bin/env bash
set -euo pipefail
root="${SOFTMARKET_DATA_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
backup_root="${BACKUP_DIR:-$root/backups}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$backup_root/$stamp"
if [[ "$out" == *"'"* || "$out" == *$'\n'* || "$out" == *$'\r'* ]]; then echo 'Unsupported backup path' >&2; exit 1; fi
mkdir -p "$backup_root" "$root/uploads"
mkdir "$out"
sqlite3 "${SQLITE_DB:-$root/data/softmarket.db}" ".backup '$out/database.sqlite'"
tar -czf "$out/uploads.tar.gz" -C "$root/uploads" .
printf 'Backup: %s\n' "$out"
