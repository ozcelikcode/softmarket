import { randomUUID } from 'node:crypto'
import { basename, resolve, relative, isAbsolute } from 'node:path'
import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import type { CollectionSlug, Field, GlobalSlug, Payload, PayloadRequest, Where } from 'payload'
import { collections, fieldsBySlug, flatFields } from './model'
import { sanitizeLexical } from './markdown'
import { isProductBound } from '@/lib/blocks/product-composition'
import { validateSeed, type Data, type RecordInput, type Seed } from './schema'

export type Source = { file: string; seed: Seed }
type Entry = { collection: CollectionSlug; input: RecordInput; file: string; key: string }
export async function loadSources(inputPath: string): Promise<Source[]> {
  const { stat } = await import('node:fs/promises')
  const files = (await stat(inputPath)).isDirectory()
    ? (await readdir(inputPath)).filter(f => f.endsWith('.json') && f !== 'schema.json').sort().map(f => resolve(inputPath, f))
    : [resolve(inputPath)]
  return Promise.all(files.map(async file => {
    let seed: unknown
    try { seed = JSON.parse(await readFile(file, 'utf8')) } catch (error) { throw new Error(`${file}: invalid JSON: ${String(error)}`) }
    validateSeed(seed, file)
    return { file, seed }
  }))
}
export async function safeMediaPath(root: string, path: string): Promise<string> {
  const canonicalRoot = await realpath(root)
  const expectedBase = resolve(canonicalRoot, 'media')
  const base = await realpath(expectedBase)
  if (base !== expectedBase) throw new Error('Media directory cannot be a symlink')
  const file = await realpath(resolve(root, path))
  const rel = relative(base, file)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Media outside content/seed/media: ${path}`)
  const info = await stat(file)
  if (!info.isFile() || info.size > 25 * 1024 * 1024) throw new Error(`Media must be a regular file no larger than 25 MiB: ${path}`)
  return file
}
function identity(collection: string, data: Data): string {
  if (collection === 'editions') return String(data.sku)
  if (collection === 'releases') return `${data.product}/${data.version}`
  if (collection === 'docs') return `${data.product}/${data.slug}`
  return String(data.slug)
}
function assertShared(fields: Field[], a: Data, b: Data, path: string): void {
  for (const field of flatFields(fields)) {
    if (!('name' in field) || field.type === 'join' || field.type === 'ui') continue
    const x = a[field.name], y = b[field.name], at = `${path}.${field.name}`
    if (field.localized) continue
    if (field.type === 'group') { assertShared(field.fields, (x ?? {}) as Data, (y ?? {}) as Data, at); continue }
    if (field.type === 'array' || field.type === 'blocks') {
      const left = (x ?? []) as Data[], right = (y ?? []) as Data[]
      if (left.length !== right.length) throw new Error(`${at}: tr/en array lengths differ`)
      left.forEach((row, i) => {
        if (row.blockType !== right[i].blockType) throw new Error(`${at}[${i}]: tr/en block types differ`)
        const fields = field.type === 'array' ? field.fields : field.blocks.find(block => typeof block !== 'string' && block.slug === row.blockType)
        assertShared(Array.isArray(fields) ? fields : fields && typeof fields !== 'string' ? fields.fields : [], row, right[i], `${at}[${i}]`)
      })
      continue
    }
    if (JSON.stringify(x) !== JSON.stringify(y)) throw new Error(`${at}: non-localized values must match in tr/en`)
  }
}
// Reuse row/block IDs in both locales and repeated imports. Do not create empty EN rows over TR translations.
function rowIDs(data: Data, previous: unknown, fields: Field[]): Data {
  const output = { ...data }
  const old = (previous ?? {}) as Data
  for (const field of flatFields(fields)) {
    if (!('name' in field)) continue
    const value = data[field.name]
    if (field.type === 'group' && value) output[field.name] = rowIDs(value as Data, old[field.name], field.fields)
    if ((field.type === 'array' || field.type === 'blocks') && Array.isArray(value)) {
      output[field.name] = value.map((row: Data, index: number) => {
        const previous = (old[field.name] as Data[] | undefined)?.[index]
        const block = field.type === 'blocks' ? field.blocks.find(b => typeof b !== 'string' && b.slug === row.blockType) : null
        const nested = field.type === 'array' ? field.fields : block && typeof block !== 'string' ? block.fields : []
        return { ...rowIDs(row, previous, nested), id: previous?.id ?? randomUUID() }
      })
    }
  }
  return output
}
// Compare only supplied fields: Payload adds defaults, timestamps and row IDs.
function matchesInput(input: unknown, stored: unknown): boolean {
  if (Array.isArray(input)) return Array.isArray(stored) && input.length === stored.length && input.every((v, i) => matchesInput(v, stored[i]))
  if (input && typeof input === 'object') {
    if (!stored || typeof stored !== 'object') return false
    return Object.entries(input).every(([key, value]) => matchesInput(value, (stored as Data)[key]))
  }
  return input === stored
}
const hasBoundBlock = (layout: unknown) => Array.isArray(layout) && layout.some(b => !!b && typeof b === 'object' && isProductBound((b as Data).blockType))
export async function importContent(options: {
  payload: Payload; sources: Source[]; root: string; dryRun?: boolean;
  /** Caller rolls the transaction back: real writes, but existing media files are never replaced on disk. */
  rollbackRun?: boolean;
  markdown: (text: string) => unknown; req?: Partial<PayloadRequest>;
  log?: (message: string) => void;
}) {
  const { payload, sources, root, dryRun = false, rollbackRun = false, markdown, req, log: emit = console.log } = options
  const log = (message: string) => emit(`${dryRun || rollbackRun ? '[dry-run] ' : ''}${message}`)
  const entries = new Map<string, Entry>()
  const ids = new Map<string, number | string>()
  const busy = new Set<string>()
  const planned = new Set<number | string>()
  function validID(value: unknown, label: string): number | string {
    // This project uses SQLite numeric IDs; planned IDs never reach the database.
    if (planned.has(value as string)) return value as string
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`Invalid database ID for ${label}: ${String(value)}`)
    }
    return value
  }
  function plan(full: string): string {
    const id = `dry:${full}`
    planned.add(id)
    return id
  }
  let creates = 0, updates = 0
  for (const { file, seed } of sources) {
    validateSeed(seed, file)
    for (const collection of collections) {
      for (const [index, input] of ((seed[collection.slug] ?? []) as RecordInput[]).entries()) {
        const at = `${file}: ${collection.slug}[${index}]`
        assertShared(collection.fields, input.tr, input.en, at)
        const key = identity(collection.slug, input.tr), full = `${collection.slug}:${key}`
        if (entries.has(full)) throw new Error(`${at}: duplicate identity ${full}`)
        entries.set(full, { collection: collection.slug as CollectionSlug, input, file: at, key })
      }
    }
  }
  async function find(collection: CollectionSlug, key: string): Promise<Data | undefined> {
    let where: Where
    if (collection === 'docs' || collection === 'releases') {
      const split = key.indexOf('/')
      if (split < 1) throw new Error(`${collection}: expected product-slug/${collection === 'docs' ? 'doc-slug' : 'version'}: ${key}`)
      const product = await reference('products', key.slice(0, split))
      if (planned.has(product)) return undefined
      validID(product, `products:${key.slice(0, split)}`)
      where = { and: [{ product: { equals: product } }, { [collection === 'docs' ? 'slug' : 'version']: { equals: key.slice(split + 1) } }] }
    } else where = { [collection === 'editions' ? 'sku' : collection === 'forms' ? 'title' : 'slug']: { equals: key } }
    const result = await payload.find({ collection, where, locale: 'tr', fallbackLocale: false, depth: 0, limit: 2, draft: true, overrideAccess: true, req })
    if (result.docs.length > 1) throw new Error(`Ambiguous reference ${collection}:${key}`)
    return result.docs[0] as unknown as Data | undefined
  }
  async function reference(collection: CollectionSlug, key: string): Promise<number | string> {
    const full = `${collection}:${key}`
    if (ids.has(full)) return ids.get(full)!
    const entry = entries.get(full)
    if (entry) return allocate(entry)
    if (collection === 'media') throw new Error(`Undeclared media path: ${key}`)
    const found = await find(collection, key)
    if (!found) throw new Error(`Unresolved relationship ${full}`)
    const id = validID(found.id, full)
    ids.set(full, id)
    return id
  }
  async function transform(fields: Field[], data: Data): Promise<Data> {
    const output = { ...data }
    for (const field of flatFields(fields)) {
      if (!('name' in field)) continue
      const value = data[field.name]
      if (value === undefined || value === null) continue
      if (field.type === 'relationship' || field.type === 'upload') {
        const one = async (item: unknown) => {
          if (Array.isArray(field.relationTo)) {
            const ref = item as { relationTo: CollectionSlug; value: string }
            return { relationTo: ref.relationTo, value: await reference(ref.relationTo, ref.value) }
          }
          return reference(field.relationTo, String(item))
        }
        output[field.name] = field.hasMany ? await Promise.all((value as unknown[]).map(one)) : await one(value)
      } else if (field.type === 'richText') output[field.name] = sanitizeLexical(markdown((value as { markdown: string }).markdown))
      else if (field.type === 'group') output[field.name] = await transform(field.fields, value as Data)
      else if (field.type === 'array') output[field.name] = await Promise.all((value as Data[]).map(row => transform(field.fields, row)))
      else if (field.type === 'blocks') output[field.name] = await Promise.all((value as Data[]).map(row => {
        const block = field.blocks.find(b => typeof b !== 'string' && b.slug === row.blockType)
        if (!block || typeof block === 'string') throw new Error(`Unknown block ${row.blockType}`)
        return transform(block.fields, row)
      }))
    }
    return output
  }
  const existing = new Set<string>()
  // Allocate identities using only scalar fields and required relationships. Optional
  // references/blocks are written afterwards, allowing product -> FAQ -> product links.
  async function allocate(entry: Entry): Promise<number | string> {
    const full = `${entry.collection}:${entry.key}`
    if (ids.has(full)) return ids.get(full)!
    if (busy.has(full)) throw new Error(`Cyclic required relationships: ${[...busy, full].join(' -> ')}`)
    busy.add(full)
    try {
      const found = await find(entry.collection, entry.key)
      let id = found ? validID(found.id, full) : undefined
      if (id) { existing.add(full); updates++ } else {
        creates++
        const scalar: Data = {}
        for (const field of flatFields(fieldsBySlug[entry.collection])) {
          if (!('name' in field) || ['array', 'blocks', 'group', 'join', 'ui'].includes(field.type)) continue
          if ((field.type === 'relationship' || field.type === 'upload') && !field.required) continue
          if (entry.input.tr[field.name] !== undefined) scalar[field.name] = entry.input.tr[field.name]
        }
        const data = await transform(fieldsBySlug[entry.collection], scalar)
        if (!dryRun) id = validID((await payload.create({ collection: entry.collection, locale: 'tr', overrideAccess: true, data: data as never, req })).id, full)
      }
      id ??= plan(full)
      ids.set(full, id)
      return id
    } catch (error) { throw new Error(`${entry.file} (${full}): ${error instanceof Error ? error.message : String(error)}`, { cause: error }) }
    finally { busy.delete(full) }
  }
  async function upsert(entry: Entry): Promise<void> {
    const full = `${entry.collection}:${entry.key}`
    try {
      const id = await allocate(entry)
      // Editor-composed product (bound blocks) + legacy seed layout: keep the stored layout, update the rest.
      let keepLayout = false
      if (entry.collection === 'products' && existing.has(full) && !hasBoundBlock(entry.input.tr.layout) && !hasBoundBlock(entry.input.en.layout)
        && (entry.input.tr.layout !== undefined || entry.input.en.layout !== undefined)) {
        const stored = await payload.findByID({ collection: 'products', id, locale: 'tr', fallbackLocale: false, depth: 0, draft: true, overrideAccess: true, req })
        keepLayout = hasBoundBlock((stored as unknown as Data | undefined)?.layout)
        if (keepLayout) log(`warn ${full} layout korundu (editörde düzenlenmiş)`)
      }
      for (const locale of ['tr', 'en'] as const) {
        // Skipped blocks must not resolve stale references or convert unused markdown either.
        const input = { ...entry.input[locale] }
        if (keepLayout) delete input.layout
        const translated = await transform(fieldsBySlug[entry.collection], input)
        if (!dryRun) {
          const previous = await payload.findByID({ collection: entry.collection, id, locale, fallbackLocale: false, depth: 0, draft: true, overrideAccess: true, req })
          const data = rowIDs(translated, previous, fieldsBySlug[entry.collection])
          if (collections.find(c => c.slug === entry.collection)?.versions) data._status = 'published'
          if (!matchesInput(data, previous)) await payload.update({ collection: entry.collection, id, locale, overrideAccess: true, data: data as never, req })
        }
      }
      log(`${existing.has(full) ? 'update' : 'create'} ${full} #${id}`)
    } catch (error) { throw new Error(`${entry.file} (${full}): ${error instanceof Error ? error.message : String(error)}`, { cause: error }) }
  }
  const filenames = new Set<string>()
  for (const { file, seed } of sources) for (const media of seed.media ?? []) {
    try {
      const path = await safeMediaPath(root, media.path), filename = basename(path)
      if (filenames.has(filename)) throw new Error(`Duplicate media filename: ${filename}`)
      filenames.add(filename)
      const found = await payload.find({ collection: 'media', where: { seedPath: { equals: media.path } }, limit: 2, depth: 0, overrideAccess: true, req })
      if (found.docs.length > 1) throw new Error(`Ambiguous media seed path ${media.path}`)
      let id = found.docs[0] ? validID(found.docs[0].id, `media:${media.path}`) : undefined
      if (found.docs[0]?.protected && !media.protected) throw new Error('Protected media cannot become public')
      if (id) updates++; else creates++
      if (!dryRun) for (const locale of ['tr', 'en'] as const) {
        const data = { alt: media.alt[locale], protected: media.protected, seedPath: media.path, visibility: 'public' as const }
        if (id) {
          // File replacement is not transactional. Refuse it rather than corrupt an
          // existing upload if a later operation fails or the process is interrupted.
          if (locale === 'tr') {
            const filename = found.docs[0]?.filename
            if (!filename || basename(filename) !== filename) throw new Error('Existing media has no safe filename')
            const staticDir = payload.collections.media.config.upload && payload.collections.media.config.upload.staticDir
            if (!staticDir || !(await readFile(path)).equals(await readFile(resolve(staticDir, filename)))) throw new Error('Existing media differs; replace it separately before importing')
          }
          await payload.update({ collection: 'media', id, locale, data, overrideAccess: true, req })
        }
        else id = validID((await payload.create({ collection: 'media', locale, data, filePath: path, overrideAccess: true, req })).id, `media:${media.path}`)
      }
      ids.set(`media:${media.path}`, id ?? plan(`media:${media.path}`))
      log(`${found.docs[0] ? 'update' : 'create'} media:${media.path}`)
    } catch (error) { throw new Error(`${file}: media:${media.path}: ${String(error)}`, { cause: error }) }
  }
  // Required relationships resolve recursively; optional cycles resolve after allocation.
  for (const entry of entries.values()) await allocate(entry)
  for (const entry of entries.values()) await upsert(entry)
  const seenGlobals = new Set<string>()
  for (const { file, seed } of sources) for (const [slug, input] of Object.entries(seed.globals ?? {})) {
    try {
      if (seenGlobals.has(slug)) throw new Error(`Duplicate global ${slug}`)
      seenGlobals.add(slug)
      assertShared(fieldsBySlug[slug], input.tr, input.en, `${file}: globals.${slug}`)
      for (const locale of ['tr', 'en'] as const) {
        const data = await transform(fieldsBySlug[slug], input[locale])
        if (!dryRun) {
          const previous = await payload.findGlobal({ slug: slug as GlobalSlug, locale, fallbackLocale: false, depth: 0, overrideAccess: true, req })
          const updated = rowIDs(data, previous, fieldsBySlug[slug])
          if (!matchesInput(updated, previous)) await payload.updateGlobal({ slug: slug as GlobalSlug, locale, data: updated as never, overrideAccess: true, req })
        }
      }
      log(`update global:${slug}`)
    } catch (error) { throw new Error(`${file}: globals.${slug}: ${String(error)}`, { cause: error }) }
  }
  return { creates, updates }
}

export async function loadLegal(root: string): Promise<Source> {
  const names = (await readdir(resolve(root, 'tr'))).filter(f => f.endsWith('.md')).sort()
  const english = (await readdir(resolve(root, 'en'))).filter(f => f.endsWith('.md')).sort()
  if (JSON.stringify(names) !== JSON.stringify(english)) throw new Error(`${root}: TR/EN legal file names must match`)
  const pages: RecordInput[] = []
  for (const name of names) {
    const entry: RecordInput = { tr: {}, en: {} }
    for (const locale of ['tr', 'en'] as const) {
      const raw = await readFile(resolve(root, locale, name), 'utf8')
      const text = raw.replace(/\]\(([a-z0-9-]+)\.md\)/g, `](/${locale}/${locale === 'tr' ? 'yasal' : 'legal'}/$1)`)
      entry[locale] = { slug: name.slice(0, -3), title: text.match(/^#\s+(.+)$/m)?.[1] ?? name.slice(0, -3), pageType: 'legal', layout: [{ blockType: 'richText', content: { markdown: text } }] }
    }
    pages.push(entry)
  }
  return { file: `${root}/{tr,en}/*.md`, seed: { version: 1, pages } }
}
