import { Ajv } from 'ajv'
import type { Field } from 'payload'
import { collections, globals, flatFields } from './model'
import { pageBlocks } from '@/blocks'
import { HERO_PRESETS } from '@/fields/block-motion'

type Schema = Record<string, unknown>
const string = { type: 'string', minLength: 1 }
const object = (properties: Record<string, Schema>, required: string[] = []): Schema => ({
  type: 'object', additionalProperties: false, properties, required,
})
const bilingual = (data: Schema) => object({ tr: data, en: data }, ['tr', 'en'])
function relation(field: Extract<Field, { type: 'relationship' | 'upload' }>): Schema {
  if (Array.isArray(field.relationTo)) return {
    oneOf: field.relationTo.map(slug => object({ relationTo: { const: slug }, value: string }, ['relationTo', 'value'])),
  }
  return string
}
function fieldSchema(field: Field): Schema {
  let schema: Schema
  switch (field.type) {
    case 'text': case 'textarea': case 'email': case 'date': case 'code': schema = string; break
    case 'number': schema = { type: 'number', ...('min' in field && field.min !== undefined ? { minimum: field.min } : {}), ...('max' in field && field.max !== undefined ? { maximum: field.max } : {}) }; break
    case 'checkbox': schema = { type: 'boolean' }; break
    case 'select': case 'radio': schema = { enum: field.options.map(o => typeof o === 'string' ? o : o.value) }; break
    case 'relationship': case 'upload': schema = relation(field); break
    case 'richText': schema = object({ markdown: { type: 'string' } }, ['markdown']); break
    case 'group': schema = fieldsSchema(field.fields); break
    case 'array': return { type: 'array', items: fieldsSchema(field.fields), ...('minRows' in field && field.minRows ? { minItems: field.minRows } : {}), ...(field.maxRows ? { maxItems: field.maxRows } : {}) }
    case 'blocks': return { type: 'array', items: { oneOf: field.blocks.filter(b => typeof b !== 'string').map(b => ({ $ref: `#/$defs/${b.slug}` })) } }
    default: throw new Error(`Unsupported seed field: ${field.type}`)
  }
  return 'hasMany' in field && field.hasMany ? { type: 'array', items: schema } : schema
}
export function fieldsSchema(fields: Field[]): Schema {
  const properties: Record<string, Schema> = {}
  const required: string[] = []
  for (const field of flatFields(fields)) {
    if (!('name' in field) || field.type === 'join' || field.type === 'ui') continue
    // Users are never a seed relationship. Forms use stable title, all others use TR slug / SKU.
    if (field.type === 'relationship' && field.relationTo === 'users') continue
    properties[field.name] = fieldSchema(field)
    if ('required' in field && field.required && !('defaultValue' in field && field.defaultValue !== undefined)) required.push(field.name)
    if (field.name === 'slug') { properties.slug = { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }; required.push('slug') }
    if (['seats', 'durationMonths'].includes(field.name)) properties[field.name] = { type: 'integer', minimum: 1 }
    if (field.name === 'sku') properties.sku = { type: 'string', pattern: '^[A-Z0-9][A-Z0-9-]{1,63}$' }
  }
  const schema = object(properties, [...new Set(required)])
  if ('licenseType' in properties) schema.allOf = [{ if: { properties: { licenseType: { const: 'subscription' } }, required: ['licenseType'] }, then: { required: ['durationMonths'] } }]
  return schema
}
export const seedSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $defs: Object.fromEntries(pageBlocks.map(block => {
    const data = fieldsSchema(block.fields)
    if (block.slug === 'hero') {
      const motion = (data.properties as Record<string, Schema>).motion
      const properties = motion.properties as Record<string, Schema>
      properties.preset = { enum: [...HERO_PRESETS] }
    }
    return [block.slug, { ...data, properties: { ...(data.properties as object), blockType: { const: block.slug } }, required: [...data.required as string[], 'blockType'] }]
  })),
  title: 'SoftMarket bilingual content seed v1',
  description: 'Records contain tr/en Payload fields. Relationships use the target TR slug (editions: SKU, forms: title, FAQs: TR slug, docs: product-slug/doc-slug). Rich text: {markdown: string}. Media references use a media/relative-file path. Shared field values and array order must match across locales.',
  ...object({
    $schema: { type: 'string' }, version: { const: 1 },
    ...Object.fromEntries(collections.map(c => [c.slug, { type: 'array', items: bilingual(fieldsSchema(c.fields)) }])),
    media: { type: 'array', items: object({ path: { type: 'string', pattern: '^media/(?!.*(?:^|/)\\.\\.(?:/|$)).+' }, alt: bilingual(string), protected: { type: 'boolean' } }, ['path', 'alt', 'protected']) },
    globals: object(Object.fromEntries(globals.map(g => [g.slug, bilingual(fieldsSchema(g.fields))]))),
  }, ['version']),
}
const validator = new Ajv({ allErrors: true, strict: false }).compile(seedSchema)
export type Data = Record<string, unknown>
export type RecordInput = { tr: Data; en: Data }
export type Seed = { version: 1; media?: { path: string; alt: { tr: string; en: string }; protected: boolean }[]; globals?: Record<string, RecordInput> } & Record<string, unknown>
export function validateSeed(input: unknown, file: string): asserts input is Seed {
  if (!validator(input)) throw new Error(`${file}: ${validator.errors?.map(e => `${e.instancePath || '/'} ${e.message} ${JSON.stringify(e.params)}`).join('; ')}`)
}
