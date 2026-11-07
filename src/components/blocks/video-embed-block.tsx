import { Container } from '@/components/ui/container'
import { Heading } from '@/components/ui/heading'
import { Section } from '@/components/ui/section'
import { toEmbedUrl } from '@/lib/video'
import type { VideoEmbedBlock as Block } from '@/payload-types'

/** Only YouTube (nocookie) and Vimeo are embeddable; anything else renders nothing. */
export function VideoEmbedBlock({ block }: { block: Block }) {
  const src = toEmbedUrl(block.url)
  if (!src) return null
  const title = block.heading || block.caption || 'Video'
  return (
    <Section theme="dark" spacing="md">
      <Container size="narrow" className="max-w-[60rem]">
        {block.heading ? <Heading size="h2" className="mb-8">{block.heading}</Heading> : null}
        <div className="aspect-video overflow-hidden rounded-xl border border-border bg-surface">
          <iframe
            src={src}
            title={title}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allow="fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="size-full"
          />
        </div>
        {block.caption ? <p className="mt-3 text-small text-muted">{block.caption}</p> : null}
      </Container>
    </Section>
  )
}
