import { readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import pkg from '../../package.json'

describe('Payload release alignment', () => {
  it('pins every direct Payload package and its installed release to 3.93.0', () => {
    const packages = Object.entries(pkg.dependencies).filter(([name]) => name === 'payload' || name.startsWith('@payloadcms/'))
    expect(packages).toHaveLength(11)
    for (const [name, version] of packages) {
      expect(version, name).toBe('3.93.0')
      const installed = JSON.parse(readFileSync(join(realpathSync(join('node_modules', name)), 'package.json'), 'utf8'))
      expect(installed.version, name).toBe(version)
    }
    // Payload's transitive packages must use the same release too.
    const snapshots = [...readFileSync('pnpm-lock.yaml', 'utf8').matchAll(/^  ['"]?(@payloadcms\/[a-z0-9-]+)@(\d+\.\d+\.\d+)[^\n]*:/gm)]
    expect(snapshots.length).toBeGreaterThan(11)
    for (const [, name, version] of snapshots) expect(version, name).toBe('3.93.0')
  })

  it('keeps Next 15.4 and React 19.2, and declares the new Node minimum', () => {
    expect(pkg.dependencies.next).toBe('15.4.11')
    expect(pkg.dependencies.react).toBe('19.2.6')
    expect(pkg.dependencies['react-dom']).toBe('19.2.6')
    expect(pkg.engines.node).toBe('>=24.22.1 <25')
    const nextPackage = JSON.parse(readFileSync(join(realpathSync('node_modules/@payloadcms/next'), 'package.json'), 'utf8'))
    expect(nextPackage.peerDependencies.next).toContain('>=15.4.11 <15.5.0')
  })
})
