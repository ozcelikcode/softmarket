import { sql } from '@payloadcms/db-sqlite'

import { localizedHref } from '@/i18n/paths'
import { MEDIA_IMAGE_WIDTHS } from '@/lib/media-sizes'
import type { PaymentTx } from '@/lib/payments/store/transaction'
import { safeUploadName } from './download-file'
import type { DownloadGrant } from './download-tokens'
import { eligibilityFields, licenseTables, type LicenseEligibility } from './entitlement'
import type { ClientBody } from './guard'
import { compareSemver, parseSemver } from './semver'

type Query = Pick<PaymentTx, 'all'>

export type DownloadRecord = {
  id: number; release: number | null; media: number; filename: string; mime: string | null; createdAt: string
}
type CatalogDownload = DownloadRecord & {
  os: string; arch: string | null; size: number | null; sha256: string | null
}
type Release = { id: number; version: string; releaseDate: string; channel: string }

const fields = sql`d.id, d.release_id AS release, d.created_at AS createdAt, m.id AS media, m.filename, m.mime_type AS mime`
const files = sql`downloads d JOIN media m ON m.id = d.file_id`
const derivativeNames = sql.join(Object.keys(MEDIA_IMAGE_WIDTHS).map(
  (size) => sql`${sql.identifier(`sizes_${size}_filename`)} = m.filename`,
), sql` OR `)
const eligible = sql`d.access IN ('public', 'licensed') AND m.protected = 1
  AND NOT EXISTS (SELECT 1 FROM media WHERE ${derivativeNames})
  AND (d.access = 'licensed'
    OR NOT EXISTS (SELECT 1 FROM downloads x WHERE x.file_id = m.id AND x.access <> 'public')
    OR EXISTS (SELECT 1 FROM downloads x WHERE x.file_id = m.id AND x.access = 'licensed' AND x.product_id = d.product_id))`

function scopedDownload(id: number, product: number, now: Date) {
  return sql`FROM ${files}
    LEFT JOIN releases r ON r.id = d.release_id
    WHERE d.id = ${id} AND d.product_id = ${product} AND ${eligible}
    AND (d.release_id IS NULL OR (r.product_id = d.product_id AND julianday(r.release_date) <= julianday(${now.toISOString()})))`
}

export async function findDownload(db: Query, id: number, product: number, now: Date) {
  const [record] = await db.all<DownloadRecord>(sql`SELECT ${fields} ${scopedDownload(id, product, now)}`)
  return record && safeUploadName(record.filename) ? record : null
}

type DownloadAccess = LicenseEligibility & {
  activation: number; license: number; customer: number; deviceStatus: string
  publicId: string; licensePublicId: string; fingerprint: string; fileMatches: number
}

export async function readDownloadAccess(db: Query, grant: DownloadGrant, now: Date) {
  const { file, activation, license, product } = grant
  // Read the current binding and both sides of the entitlement in a single SQLite snapshot.
  const [access] = await db.all<DownloadAccess>(sql`SELECT ${eligibilityFields},
    a.status AS deviceStatus, a.id AS activation, a.public_id AS publicId, a.fingerprint_hash AS fingerprint,
    l.id AS license, l.public_id AS licensePublicId, l.customer_id AS customer,
    EXISTS (SELECT 1 ${scopedDownload(file.id, product, now)} AND d.created_at = ${file.createdAt}
      AND d.release_id IS ${file.release} AND m.id = ${file.media} AND m.filename = ${file.filename} AND m.mime_type IS ${file.mime}) AS fileMatches
    FROM ${licenseTables} JOIN license_activations a ON a.license_id = l.id
    WHERE a.public_id = ${activation.slice(4)} AND l.public_id = ${license} AND l.product_id = ${product}
      AND a.product_id = l.product_id AND a.customer_id = l.customer_id`)
  return access
}

export async function updates(db: Query, product: number, body: ClientBody<'updates'>, now: Date) {
  const releases = await db.all<Release>(sql`
    SELECT id, version, release_date AS releaseDate, channel FROM releases
    WHERE product_id = ${product} AND channel = ${body.channel} AND julianday(release_date) <= julianday(${now.toISOString()})
    ORDER BY julianday(release_date) DESC, id DESC`)
  const current = parseSemver(body.currentVersion)!
  let best = current
  let latest: Release | undefined
  for (const candidate of releases) {
    const version = parseSemver(candidate.version)
    if (!version || compareSemver(version, best) <= 0) continue
    best = version
    latest = candidate
  }
  if (!latest) return { latest: null }

  const records = await db.all<CatalogDownload>(sql`SELECT ${fields}, d.os, d.arch, m.filesize AS size, d.checksum_sha256 AS sha256
    FROM ${files} WHERE d.release_id = ${latest.id} AND d.product_id = ${product} AND ${eligible} AND d.os = ${body.os}
    ${body.arch === undefined ? sql`` : sql`AND (d.arch IS NULL OR d.arch IN (${body.arch}, 'universal'))`}
    ORDER BY d.id`)
  const downloads = records.flatMap(({ id, filename, os, arch, size, sha256 }) =>
    safeUploadName(filename) && size !== null && Number.isSafeInteger(size) && size >= 0
      ? [{ id, os, arch, size, ...(/^[a-f\d]{64}$/i.test(sha256 ?? '') ? { sha256: sha256!.toLowerCase() } : {}) }]
      : [])
  return { latest: {
    version: latest.version, releaseDate: latest.releaseDate, channel: latest.channel,
    notesUrl: localizedHref(`/destek/surum-notlari#rel-${product}`, 'en'), mandatory: false, downloads,
  } }
}
