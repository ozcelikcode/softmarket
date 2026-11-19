# F9 image pipeline verification — 2026-11-07

`thumb=400`, `card=768`, `hero=1280`, `wide=1920`; WebP quality 74. Widths preserve the source aspect ratio. In Payload 3.85.1, `withoutEnlargement: undefined` **skips** larger targets, whereas `true` generates redundant files at the source size. A 500 px fixture produced only a 400 px file. Admin crop/focal point is enabled; CSS cropping uses focalX/Y. Crop and 0/100 edge focal coordinates were verified in a real Payload test.

MediaImage consumes an access-checked, populated relationship; it does not derive URLs from ID/filename. Native `img` uses the Payload endpoint directly and does not go through the shared Next optimizer. Legacy records without size metadata fall back to the original. Srcset is ordered from WebP candidates; `width/height`, lazy default, eager/high for the first hero, and responsive preload are in place. The container's 20/32 px horizontal padding and CMS hero width/grid gap are included in the sizes calculation. Blocks, cards, rich text, logo wall, and header images use the shared component.

## Access evidence

DB copy + isolated uploads + `.next-prod` / 3200 with three media items (public, protected, and licensed), each with original + four sizes, across anonymous/customer/staff: **45 HTTP checks**. Public returns 200 to everyone; protected/licensed return 404 to anonymous and unlicensed customers, and 200 to staff. All file responses are `private, no-store`. A protected URL request through Next optimizer returns 400. Real Payload handler + SQLite tests also verify 200 with a valid license and 404 after license revocation.

Static filename queries bind to the **same media record** via `filename OR sizes.<ad>.filename` and the existing `mediaRead` license/download filter. The endpoint also enforces its own access query; there is no direct public serving from disk.

F8 HTTP regression: the draft of the landing page in the copy contains protected media. Staff + draft sees the protected srcset and the response is private/no-store. Draft cookie alone, customer + draft, and anonymous non-draft requests only see the public/published image. The subsequent anonymous response also contains no protected URLs.

## Size and performance

Live DB has 0 media items; measurements are on a **synthetic textured 2400×1600 fixture**. Because 1280 px output at quality 78 was 206548 bytes, quality 74 was selected.

| Screen / DPR | sizes slot | Expected candidate | HTTP file size |
|---|---:|---:|---:|
| 390 px / 1 | 350 px | 400 px | 1240 bytes |
| 390 px / 2 | 350 px | 768 px | 23280 bytes |
| 390 px / 3 | 350 px | 1280 px | 171172 bytes |

Candidates were calculated from the published HTML sizes/srcset contract, not browser `currentSrc` measurements. The fixture mobile budget is ≤180 KB; this value is not an automatic file size guarantee for every possible content/screen.

Warm production requests (5 samples, median response header time): `/tr` 2.48 ms, `/en` 2.39 ms, `/tr/urunler` 17.16 ms. These are not LCP measurements.

**Open acceptance verification:** New LCP/CLS and real browser candidate selection could not be measured. Chromium/Playwright failed to launch on macOS with `MachPortRendezvousServer: Permission denied (1100)`; Lighthouse failed while waiting for the debugging port. Current browser connection reported `browser access host is unavailable`; WebKit could not be launched either. Therefore, **no claim of no LCP regression is made**. Older F0/F2 measurements were not substituted as new F9 measurements. Lighthouse and currentSrc checks must be re-run against the same 3200 build in a permitted browser environment.

## Migration and regenerate

`20261107_192347_media_image_sizes`: up only has 24 ADD COLUMN + 4 CREATE INDEX. focalX/Y already existed. Down only drops its own indexes/columns; the generated down has no table rebuild and did not need manual rewriting. A real transaction down/up test preserves media, locale, and relationship rows; FK check is clean.

Created and applied first on scratchpad `f9-copy.db`. Before live, `softmarket-pre-f9.db`, `-wal`, `-shm`, and consistent `.snapshot.db` backups were taken; then `pnpm migrate` was applied. Old row/column values in live match the snapshot identically; integrity_check=ok, FK violations=0.

`pnpm media:regenerate` processes raster media paginated and sequentially; larger targets are not generated. Complete outputs already on disk are skipped. Derivatives are generated in a 0700 temp directory, moved with 0600 permissions to new random names, and then database references are updated; the original file is not rewritten. On failure, newly uploaded files are cleaned up; if the process is forcefully killed, orphaned files may remain. Old derivatives are not deleted for concurrent clients and separate disk cleanup may be needed. If the same record changes during processing, the update is rejected. Symlinks and file paths escaping root are rejected. Derivatives do not retain EXIF/GPS. **Original file metadata risk was closed for new uploads:** the Media `beforeOperation` hook re-encodes JPEG/PNG/WebP/TIFF/HEIC/HEIF files with sharp, applying orientation, before Payload processes the original and derivatives. EXIF (including GPS), XMP, and IPTC are stripped; only ICC may be preserved. JPEG q90/mozjpeg, PNG lossless, WebP lossless, and TIFF LZW are used; format and extension are preserved. HEIC requires libvips with HEVC support; support/decode/encode or metadata check errors are rejected with HTTP 400. SVG/GIF/video/PDF are not modified by this hook. Existing files are not scanned/rewritten; regenerate continues to preserve the original file. Tests in temporary SQLite and uploads directories verify absence of metadata, physical orientation, and 40×80 dimensions on saved originals of JPEGs containing GPS EXIF + XMP; PNG/WebP/TIFF stripping, replacement upload from a temp file, and that no file/record is created on error.

`generate:types`, `generate:importmap`, typecheck, lint, 47 files / 591 tests, and production build succeeded. The import schema's media input contract did not change. `/tr`, `/en`, `/tr/urunler`, `/admin` 200; `/tr/olmayan` 404. Test fixtures exist only in the DB copy. Port 3200 was shut down (ECONNREFUSED); port 3100 remains open, `.next` is preserved; no commit.
