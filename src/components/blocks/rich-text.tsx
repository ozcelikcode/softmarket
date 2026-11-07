import { MediaImage } from '@/components/ui/media-image'
import {
  RichText as PayloadRichText,
  type JSXConvertersFunction,
} from '@payloadcms/richtext-lexical/react'

import { AppLink } from '@/components/ui/app-link'
import { mediaOf } from '@/lib/content'
import { referencePath } from '@/lib/site'
import { cn, safeHref } from '@/lib/utils'

type LinkNode = {
  children: never[]
  fields?: {
    url?: string
    newTab?: boolean
    linkType?: string
    doc?: { relationTo: string; value: unknown } | null
  }
}

/** Lexical content with link hrefs validated by safeHref and routed through the localized AppLink. */
export function RichContent({
  data,
  locale,
  className,
}: {
  data: unknown
  locale: string
  className?: string
}) {
  if (!data || typeof data !== 'object' || !('root' in data)) return null
  const root = data.root
  if (!root || typeof root !== 'object' || !('children' in root) || !Array.isArray(root.children))
    return null
  const children = root.children.filter(
    (node) => node && typeof node === 'object' && typeof node.type === 'string',
  )
  const converters: JSXConvertersFunction = ({ defaultConverters }) => {
    const link = ({
      node,
      nodesToJSX,
    }: {
      node: unknown
      nodesToJSX: (a: { nodes: never[] }) => React.ReactNode
    }) => {
      const n = node as LinkNode
      const href =
        n.fields?.linkType === 'internal'
          ? safeHref(referencePath(n.fields.doc ?? null))
          : safeHref(n.fields?.url)
      const children = nodesToJSX({ nodes: n.children })
      if (!href) return <span>{children}</span>
      return (
        <AppLink href={href} locale={locale} target={n.fields?.newTab ? '_blank' : undefined}>
          {children}
        </AppLink>
      )
    }
    return {
      ...defaultConverters,
      link,
      autolink: link,
      text: (args) =>
        typeof args.node.text === 'string' && typeof defaultConverters.text === 'function'
          ? defaultConverters.text(args)
          : null,
      // CMS JSON is not allowed to choose arbitrary HTML element names.
      heading: ({ node, nodesToJSX }) => {
        const Tag = /^h[2-6]$/.test(node.tag) ? node.tag : 'h2'
        const anchor = (node as unknown as { anchor?: string }).anchor
        return (
          <Tag id={anchor && /^doc-heading-\d+$/.test(anchor) ? anchor : undefined}>
            {nodesToJSX({ nodes: node.children })}
          </Tag>
        )
      },
      list: ({ node, nodesToJSX }) => {
        const Tag = node.tag === 'ol' ? 'ol' : 'ul'
        return <Tag className={`list-${node.listType}`}>{nodesToJSX({ nodes: node.children })}</Tag>
      },
      upload: ({ node }) => {
        if (node.relationTo !== 'media') return null
        const media = mediaOf(node.value)
        if (!media) return null
        const upload = node.value as { mimeType?: string; filename?: string }
        if (!upload.mimeType?.startsWith('image/')) {
          return (
            <a href={media.url!} rel="noopener noreferrer">
              {upload.filename}
            </a>
          )
        }
        return (
          <MediaImage media={media} alt={typeof node.fields?.alt === 'string' ? node.fields.alt : (media.alt ?? '')} sizes="(min-width: 1024px) 960px, 100vw" className="h-auto" />
        )
      },
    } as ReturnType<JSXConvertersFunction>
  }
  return (
    <div className={cn('rich-text', className)}>
      <PayloadRichText
        data={{ ...data, root: { ...root, children } } as never}
        converters={converters}
        disableContainer
      />
    </div>
  )
}
