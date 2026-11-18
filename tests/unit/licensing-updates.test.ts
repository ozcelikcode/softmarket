import { expect, it } from 'vitest'

import { parseClientBody } from '@/lib/licensing/api/guard'
import { compareSemver, parseSemver } from '@/lib/licensing/api/semver'

it('orders numeric and prerelease components without precision loss or build metadata precedence', () => {
  const versions = [
    '1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2',
    '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0', '1.0.10', '10.0.0',
    '9007199254740992.0.0', '9007199254740993.0.0',
  ]
  for (let index = 1; index < versions.length; index++) {
    expect(compareSemver(parseSemver(versions[index - 1]!)!, parseSemver(versions[index]!)!)).toBeLessThan(0)
  }
  expect(compareSemver(parseSemver('1.0.0+one')!, parseSemver('1.0.0+two')!)).toBe(0)
})

const update = { channel: 'stable', currentVersion: '1.0.0', os: 'macos' }
it.each([
  { channel: 'preview' }, { os: 'unknown' }, { arch: 'x86_64' }, { arch: null },
  { currentVersion: '01.0.0' }, { currentVersion: '1.0.0-01' }, { currentVersion: '1.0.0\n' },
  { currentVersion: '1'.repeat(30) + '.0.0' }, { productCode: 'another-product' },
])('rejects unsupported update fields or values (%j)', (patch) => {
  expect(parseClientBody('updates', Buffer.from(JSON.stringify({ ...update, ...patch })))).toBeNull()
})

it('accepts the supported update shape without an architecture', () => {
  expect(parseClientBody('updates', Buffer.from(JSON.stringify(update)))).toEqual(update)
})

it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '12', null])('rejects invalid download ID %s', (downloadId) => {
  expect(parseClientBody('downloads/link', Buffer.from(JSON.stringify({ downloadId })))).toBeNull()
})
