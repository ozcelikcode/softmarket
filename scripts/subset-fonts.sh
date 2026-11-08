#!/usr/bin/env bash
# Regenerates the subset Geist webfonts in src/fonts from the `geist` npm package (OFL-1.1).
# Requires fonttools + brotli: python3 -m venv .venv-fonts && .venv-fonts/bin/pip install fonttools brotli
# PYFTSUBSET=<path to pyftsubset> scripts/subset-fonts.sh
set -euo pipefail
cd "$(dirname "$0")/.."
SUBSET=${PYFTSUBSET:-pyftsubset}
SRC=node_modules/geist/dist/fonts
# Keep in sync with the unicode-range declarations in src/app/(frontend)/[locale]/layout.tsx.
# Primary (preloaded): Basic Latin + Latin-1 + Turkish ĞğİıŞş + common punctuation/arrows/€/₺.
LATIN="U+0000-00FF,U+011E-011F,U+0130-0131,U+0152-0153,U+015E-015F,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+2000-206F,U+20AC,U+20BA,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD"
# Rest of Latin Extended-A (+ a few symbols): separate file, fetched only when a page contains these characters.
LATIN_EXT="U+0100-011D,U+0120-012F,U+0132-0151,U+0154-015D,U+0160-017F,U+0192,U+0218-021B,U+02C7,U+02D8-02D9,U+02DB,U+02DD,U+0300-0303,U+0306-0307,U+030A-030C,U+0326-0328,U+2113,U+2116,U+2194-2199,U+2219,U+221E,U+2248,U+2260,U+2264-2265,U+2713,U+2715"
# Mono is only used for numbers, versions, checksums, keys and short UI labels: Latin-1 + Turkish letters.
MONO="U+0020-007E,U+00A0-00FF,U+011E-011F,U+0130-0131,U+015E-015F,U+2013-2014,U+2026,U+2192"
"$SUBSET" "$SRC/geist-sans/Geist-Variable.woff2" --unicodes="$LATIN" --layout-features+=tnum,case --flavor=woff2 --output-file=src/fonts/geist-sans-latin.woff2
"$SUBSET" "$SRC/geist-sans/Geist-Variable.woff2" --unicodes="$LATIN_EXT" --layout-features+=tnum,case --flavor=woff2 --output-file=src/fonts/geist-sans-latin-ext.woff2
"$SUBSET" "$SRC/geist-mono/GeistMono-Variable.woff2" --unicodes="$MONO" --flavor=woff2 --output-file=src/fonts/geist-mono-latin.woff2
cp node_modules/geist/LICENSE.txt src/fonts/OFL.txt
ls -l src/fonts
