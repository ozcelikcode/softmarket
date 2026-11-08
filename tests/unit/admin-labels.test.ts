import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { ADMIN_GROUPS, COLLECTION_LABELS, GLOBAL_LABELS, localizeCollection, localizeGlobal } from '../../src/lib/admin-i18n'
import { anyone, isAdmin, isAdminOrEditor, nobody } from '../../src/access'
import { publicSearchRead } from '../../src/access/search'
import { mcpCollections } from '../../src/lib/mcp'

/*
 * F10 admin label audit. Walks every collection and global (raw config, before Payload's sanitizer
 * invents English labels from field names) after `localizeCollection/localizeGlobal` and requires
 * a TR and EN value for everything an editor sees: collection/global labels, groups, fields, array rows,
 * tabs, select options and block labels/groups.
 *
 * Exceptions (documented):
 *  - hidden/disabled fields and `ui` fields are never shown.
 *  - plugin collections (forms, form-submissions, search) keep the plugin's own field translations;
 *    only their collection labels/groups are ours (checked via COLLECTION_LABELS / ADMIN_GROUPS).
 *  - Live Preview breakpoint labels are plain strings: Payload renders `label` as a React child, so an { tr, en } object would crash.
 */

// Every file in src/collections and src/globals is audited, so a new collection cannot skip the label rules.
const load = async (dir: string) =>
  Object.fromEntries(await Promise.all(readdirSync(path.resolve(__dirname, '../../src', dir)).filter((f) => f.endsWith('.ts')).map(async (f) => [f, (await import(`../../src/${dir}/${f.replace(/\.ts$/, '')}.ts`)) as Record<string, unknown>])))
const collectionModules = await load('collections')
const globalModules = await load('globals')

type Cfg = { slug: string; fields: unknown[]; admin?: { group?: unknown }; labels?: unknown; label?: unknown }
const pick = (mods: Record<string, Record<string, unknown>>): Cfg[] =>
  Object.values(mods).flatMap((m) => Object.values(m).filter((v): v is Cfg => !!v && typeof v === 'object' && 'slug' in v && 'fields' in v))

// Identical TR/EN values that are legitimate (proper nouns, units, technical tokens).
const SAME_OK = new Set([
  'Windows', 'macOS', 'Linux', 'Web / SaaS', 'Android', 'iOS', 'Beta', 'Normal', 'Blog', 'x64', 'arm64', 'x86', 'LinkedIn', 'X',
  'YouTube', 'Instagram', 'Facebook', 'GitHub', 'Türkçe', 'English', 'Site', 'SKU', 'Logo', 'Tablet', 'Platform', 'Minimum',
  'Form', 'Favicon', 'Hero', 'Blok', 'Slug', 'SEO', 'FAQ', 'Banner', 'Video', 'Tablo',
])

const EN_WORDS = new Set((
  'the and of for with to your from when empty optional used shown is are not this that by or as at be it can will must only leave ' +
  'generated field items item title description summary image name settings enabled show hide page link text'
).split(' '))

type Issue = string
const issues: Issue[] = []
const counts = { labels: 0, descriptions: 0, options: 0 }

const isLoc = (v: unknown): v is { tr: string; en: string } =>
  !!v && typeof v === 'object' && typeof (v as { tr?: unknown }).tr === 'string' && typeof (v as { en?: unknown }).en === 'string'

function checkLoc(where: string, v: unknown, kind: 'labels' | 'descriptions' | 'options', allowSame = false) {
  if (!isLoc(v) || !v.tr.trim() || !v.en.trim()) return void issues.push(`${where}: TR/EN değeri eksik (${JSON.stringify(v)})`)
  counts[kind]++
  if (v.tr === v.en && !allowSame && !SAME_OK.has(v.tr) && v.tr.length > 3) issues.push(`${where}: TR ve EN aynı ("${v.tr}")`)
  const text = v.tr.replace(/"[^"]*"|\{[^}]*\}|`[^`]*`|\([^)]*\)|[A-Za-z]+\/[A-Za-z]+|\/\S+/g, ' ')
  const hit = text.toLowerCase().split(/[^a-zçğıöşü]+/).filter((w) => EN_WORDS.has(w))
  if (hit.length) issues.push(`${where}: TR değerinde İngilizce kalıntı (${hit.join(',')}): "${v.tr}"`)
}

type F = Record<string, unknown> & { type?: string; name?: string; fields?: F[]; tabs?: F[]; blocks?: F[]; options?: unknown[] }

function walk(where: string, fields: F[]) {
  for (const f of fields) {
    const admin = (f.admin ?? {}) as { hidden?: unknown; disabled?: unknown; description?: unknown }
    if (f.type === 'tabs') {
      for (const t of f.tabs ?? []) {
        const tw = `${where}/tab:${t.name ?? JSON.stringify(t.label)}`
        checkLoc(`${tw}.label`, t.label, 'labels')
        if (t.description !== undefined) checkLoc(`${tw}.description`, t.description, 'descriptions')
        walk(tw, t.fields ?? [])
      }
      continue
    }
    if (f.type === 'ui' || f.hidden || admin.hidden || admin.disabled) continue
    if (!f.name) {
      if (f.type === 'collapsible') checkLoc(`${where}/collapsible.label`, f.label, 'labels')
      walk(where, f.fields ?? [])
      continue
    }
    const fw = `${where}.${f.name}`
    if (f.label !== false) checkLoc(`${fw}.label`, f.label, 'labels', true)
    if (admin.description !== undefined) checkLoc(`${fw}.description`, admin.description, 'descriptions')
    if (f.type === 'array') {
      const l = (f.labels ?? {}) as { singular?: unknown; plural?: unknown }
      checkLoc(`${fw}.labels.singular`, l.singular, 'labels', true)
      checkLoc(`${fw}.labels.plural`, l.plural, 'labels', true)
    }
    for (const o of f.options ?? []) {
      const opt = o as { value?: string; label?: unknown }
      // Language-neutral identifiers (icon ids such as "cpu", numbers such as "3") may stay plain.
      const neutral = (typeof o === 'string' ? o : opt.label === opt.value ? opt.label : undefined)
      if (typeof neutral === 'string' && /^[a-z0-9-]+$/.test(neutral)) counts.options++
      else checkLoc(`${fw}.option[${opt.value}]`, opt.label, 'options', true)
    }
    for (const b of f.blocks ?? []) {
      const bw = `${fw}<${b.slug}>`
      const l = (b.labels ?? {}) as { singular?: unknown; plural?: unknown }
      checkLoc(`${bw}.labels.singular`, l.singular, 'labels', true)
      checkLoc(`${bw}.labels.plural`, l.plural, 'labels', true)
      const g = ((b.admin ?? {}) as { group?: unknown }).group
      if (g !== undefined) checkLoc(`${bw}.group`, g, 'labels', true)
      if (!b.imageURL || !existsSync(path.resolve(__dirname, '../../public', String(b.imageURL).replace(/^\//, '')))) issues.push(`${bw}: önizleme görseli yok (${String(b.imageURL)})`)
      walk(bw, (b.fields ?? []) as F[])
    }
    walk(fw, f.fields ?? [])
  }
}

const collections = pick(collectionModules).map((c) => localizeCollection(c as never) as unknown as Cfg)
const globals = pick(globalModules).map((g) => localizeGlobal(g as never) as unknown as Cfg)

// Remove only presentation metadata; keep function references, defaults, conditions,
// access, hooks and all schema properties. String options and { value, label } are equivalent.
function behavior(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) return value.map((v) => behavior(key === 'options' && typeof v === 'string' ? { value: v } : v))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([k, v]) =>
    !['label', 'labels', 'description', 'group'].includes(k) && v !== undefined,
  ).map(([k, v]) => [k, behavior(v, k)]).filter(([k, v]) =>
    k !== 'admin' || !v || typeof v !== 'object' || Object.keys(v).length > 0,
  ))
}

for (const c of collections) {
  checkLoc(`${c.slug}.labels.singular`, (c.labels as { singular?: unknown } | undefined)?.singular, 'labels', true)
  checkLoc(`${c.slug}.labels.plural`, (c.labels as { plural?: unknown } | undefined)?.plural, 'labels', true)
  checkLoc(`${c.slug}.admin.group`, c.admin?.group, 'labels', true)
  walk(c.slug, c.fields as F[])
}
for (const g of globals) {
  checkLoc(`${g.slug}.label`, g.label, 'labels', true)
  checkLoc(`${g.slug}.admin.group`, g.admin?.group, 'labels', true)
  walk(g.slug, g.fields as F[])
}

describe('F10 admin labels (TR + EN)', () => {
  it('preserves every non-presentation setting and does not mutate source configurations', () => {
    for (const [configs, localize] of [
      [pick(collectionModules), (c: Cfg) => localizeCollection(c as never)],
      [pick(globalModules), (g: Cfg) => localizeGlobal(g as never)],
    ] as const) {
      for (const raw of configs) {
        const before = behavior(raw)
        const localized = localize(raw)
        expect(behavior(localized), raw.slug).toEqual(before)
        expect(behavior(raw), `${raw.slug} source`).toEqual(before)
        expect(localize(localized as never), `${raw.slug} idempotency`).toEqual(localized)
      }
    }
  })

  it('retains plugin access policies and MCP exclusions in the built Payload config', async () => {
    const previousSecret = process.env.PAYLOAD_SECRET
    process.env.PAYLOAD_SECRET ||= 'f10-config-test-no-database'
    try {
      const config = await (await import('../../src/payload.config')).default
      const expected = {
        forms: { read: anyone, create: isAdminOrEditor, update: isAdminOrEditor, delete: isAdminOrEditor },
        'form-submissions': { read: isAdminOrEditor, create: nobody, update: nobody, delete: isAdmin },
        search: { read: publicSearchRead, create: nobody, update: isAdmin, delete: isAdmin },
      }
      for (const [slug, access] of Object.entries(expected)) {
        const collection = config.collections.find((c) => c.slug === slug)!
        for (const [operation, policy] of Object.entries(access)) expect(collection.access[operation as keyof typeof access], `${slug}.${operation}`).toBe(policy)
        expect(mcpCollections).not.toHaveProperty(slug)
        expect(collection.labels).toMatchObject({ singular: { tr: expect.any(String), en: expect.any(String) } })
      }
      const keys = config.collections.find((c) => c.slug === 'payload-mcp-api-keys')!
      expect(keys.admin.hidden).toBe(true)
      for (const operation of ['read', 'create', 'update', 'delete'] as const) expect(keys.access[operation]).toBe(nobody)
      expect(config.globals.find((g) => g.slug === 'site-settings')!.access.update).toBe(isAdmin)
    } finally {
      if (previousSecret === undefined) delete process.env.PAYLOAD_SECRET
      else process.env.PAYLOAD_SECRET = previousSecret
    }
  })

  it('discovers every collection and global', () => {
    expect(collections.length).toBeGreaterThanOrEqual(20)
    expect(globals.map((g) => g.slug).sort()).toEqual(['footer', 'header', 'site-settings'])
    for (const c of collections) expect(COLLECTION_LABELS[c.slug], c.slug).toBeTruthy()
    for (const g of globals) expect(GLOBAL_LABELS[g.slug], g.slug).toBeTruthy()
  })

  it('has a TR and EN value for every editor-visible label, description, option, tab, array row and block', () => {
    // Blocks are shared by several collections: report each problem once, keyed from the block on.
    const unique = [...new Set(issues.map((i) => i.replace(/^[^.]*?(\/tab:\{[^}]*\})?(\.layout<)/, 'layout<')))]
    expect(unique).toEqual([])
    expect(counts.labels).toBeGreaterThan(300)
  })

  it('uses localized admin groups only', () => {
    const allowed = new Set(Object.values(ADMIN_GROUPS).map((g) => g.tr))
    for (const c of [...collections, ...globals]) expect(allowed.has((c.admin?.group as { tr: string }).tr), c.slug).toBe(true)
  })

  it('applies the dictionary in payload.config and localizes plugin collection labels', () => {
    const src = readFileSync(path.resolve(__dirname, '../../src/payload.config.ts'), 'utf8')
    expect(src).toContain('.map(localizeCollection)')
    expect(src).toContain('.map(localizeGlobal)')
    for (const slug of ['forms', 'form-submissions', 'search']) expect(src).toContain(`pluginLabels('${slug}')`)
    expect(src).not.toMatch(/group: '[A-Za-z]+'/)
  })
})

describe('SEO plugin field labels (F11 follow-up)', () => {
  it('labels every default meta field in TR and EN', async () => {
    const { seoPlugin } = await import('@payloadcms/plugin-seo')
    const { localizeSeoFields } = await import('../../src/lib/admin-i18n')
    const out = seoPlugin({ collections: ['pages'], uploadsCollection: 'media', tabbedUI: true, fields: localizeSeoFields })(
      { collections: [{ slug: 'pages', fields: [{ name: 'title', type: 'text' }] }] } as never,
    ) as unknown as { collections: { fields: unknown[] }[] }
    const json = JSON.stringify(out.collections[0].fields)
    const meta = (JSON.parse(json) as { tabs: { fields: { name?: string; fields?: { name: string; label?: unknown }[] }[] }[] }[])
    const group = meta[0].tabs.flatMap((t) => t.fields).find((f) => f.name === 'meta')!
    const fields = group.fields!
    expect(fields.map((f) => f.name).sort()).toEqual(['description', 'image', 'overview', 'preview', 'title'])
    for (const f of fields) {
      const l = f.label as { tr: string; en: string }
      expect(l.tr, f.name).toBeTruthy()
      expect(l.en, f.name).toBeTruthy()
      expect(l.tr).not.toBe(l.en)
    }
  })
})
