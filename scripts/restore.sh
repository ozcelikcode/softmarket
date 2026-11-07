#!/usr/bin/env bash
set -euo pipefail
root="${SOFTMARKET_DATA_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
backup="${1:?Usage: restore.sh BACKUP_DIRECTORY}"
test -f "$backup/database.sqlite"
python3 - "$backup" <<'PY'
import pathlib, sqlite3, sys, tarfile
backup = pathlib.Path(sys.argv[1])
with sqlite3.connect(f'{(backup / "database.sqlite").resolve().as_uri()}?mode=ro&immutable=1', uri=True) as db:
    if db.execute('PRAGMA integrity_check').fetchone() != ('ok',):
        raise SystemExit('Invalid backup database')
with tarfile.open(backup / 'uploads.tar.gz', 'r:gz') as archive:
    for member in archive:
        path = pathlib.PurePosixPath(member.name)
        if path.is_absolute() or '..' in path.parts or not (member.isfile() or member.isdir()):
            raise SystemExit('Unsafe uploads archive')
PY
if [[ "${RESTORE_SERVICE:-1}" == 1 ]]; then
  sudo systemctl stop softmarket litestream
  trap 'sudo systemctl start litestream softmarket' EXIT
elif [[ -z "${SOFTMARKET_DATA_ROOT:-}" ]]; then
  echo 'Offline restore requires an explicit SOFTMARKET_DATA_ROOT' >&2; exit 1
fi
mkdir -p "$root/data" "$root/uploads"
python3 - "$root" "$backup" <<'PY'
import pathlib, shutil, sys
root, backup = map(pathlib.Path, sys.argv[1:])
for suffix in ('-wal', '-shm'):
    (root / 'data' / ('softmarket.db' + suffix)).unlink(missing_ok=True)
shutil.copyfile(backup / 'database.sqlite', root / 'data' / 'softmarket.db')
for path in (root / 'uploads').iterdir():
    if path.is_dir() and not path.is_symlink(): shutil.rmtree(path)
    else: path.unlink()
PY
tar -xzf "$backup/uploads.tar.gz" -C "$root/uploads"
