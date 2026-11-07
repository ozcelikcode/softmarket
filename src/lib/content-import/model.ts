import type { Field } from 'payload'
import { ProductFamilies } from '@/collections/ProductFamilies'
import { Products } from '@/collections/Products'
import { Editions } from '@/collections/Editions'
import { Solutions } from '@/collections/Solutions'
import { Industries } from '@/collections/Industries'
import { Faqs } from '@/collections/Faqs'
import { Docs } from '@/collections/Docs'
import { Releases } from '@/collections/Releases'
import { Posts } from '@/collections/Posts'
import { Pages } from '@/collections/Pages'
import { Header } from '@/globals/Header'
import { Footer } from '@/globals/Footer'
import { SiteSettings } from '@/globals/SiteSettings'

export const collections = [ProductFamilies, Industries, Products, Editions, Solutions, Faqs, Docs, Releases, Posts, Pages]
export const globals = [Header, Footer, SiteSettings]
export const fieldsBySlug = Object.fromEntries([...collections, ...globals].map(c => [c.slug, c.fields]))
export function flatFields(fields: Field[]): Field[] {
  return fields.flatMap(field => {
    if (field.type === 'tabs') return field.tabs.flatMap(tab => 'name' in tab ? [] : flatFields(tab.fields))
    if (field.type === 'row' || field.type === 'collapsible') return flatFields(field.fields)
    return [field]
  })
}
