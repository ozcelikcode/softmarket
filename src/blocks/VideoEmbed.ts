import type { Block } from 'payload'

import { blockSettings } from '@/fields/block-settings'

import { L, blockMeta } from './meta'

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
  ...blockMeta('videoEmbed', ['Video', 'Video embed'], ['Videolar', 'Video embeds'], 'content'),
  fields: [
    { name: 'heading', type: 'text', localized: true, label: L('Başlık', 'Heading') },
    {
      name: 'url',
      type: 'text',
      localized: true,
      required: true,
      label: L('Video adresi', 'Video URL'),
      admin: { description: L('Yalnız https YouTube veya Vimeo adresleri.', 'Only https YouTube or Vimeo URLs.') },
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
    { name: 'poster', type: 'upload', relationTo: 'media', label: L('Kapak görseli', 'Poster') },
    { name: 'caption', type: 'text', localized: true, label: L('Alt yazı', 'Caption') },
    blockSettings('videoEmbed'),
  ],
}
