import type { Block } from 'payload'

/** Only these hosts are accepted to avoid arbitrary iframe sources. */
export const ALLOWED_VIDEO_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
  'vimeo.com',
  'player.vimeo.com',
]

export const VideoEmbed: Block = {
  slug: 'videoEmbed',
  interfaceName: 'VideoEmbedBlock',
  labels: { singular: 'Video Embed', plural: 'Video Embeds' },
  fields: [
    { name: 'heading', type: 'text', localized: true },
    {
      name: 'url',
      type: 'text',
      localized: true,
      required: true,
      validate: (value: string | null | undefined) => {
        if (!value) return 'URL is required.'
        try {
          const url = new URL(value)
          if (url.protocol !== 'https:') return 'Only https URLs are allowed.'
          return ALLOWED_VIDEO_HOSTS.includes(url.hostname)
            ? true
            : `Allowed hosts: ${ALLOWED_VIDEO_HOSTS.join(', ')}`
        } catch {
          return 'Invalid URL.'
        }
      },
    },
    { name: 'poster', type: 'upload', relationTo: 'media' },
    { name: 'caption', type: 'text', localized: true },
  ],
}
