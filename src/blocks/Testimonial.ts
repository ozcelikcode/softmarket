import type { Block } from 'payload'

import { blockMotion } from '@/fields/block-motion'
import { blockSettings } from '@/fields/block-settings'
import { publicImageFilter } from '@/fields/public-media'

import { L, blockMeta } from './meta'

export const Testimonial: Block = {
  slug: 'testimonial',
  interfaceName: 'TestimonialBlock',
  ...blockMeta('testimonial', ['Müşteri görüşü', 'Testimonial'], ['Müşteri görüşleri', 'Testimonials'], 'proof'),
  fields: [
    { name: 'quote', type: 'textarea', localized: true, required: true, label: L('Alıntı', 'Quote') },
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, label: L('Kişi', 'Person'), admin: { width: '33%' } },
        { name: 'role', type: 'text', localized: true, label: L('Unvan', 'Title'), admin: { width: '33%' } },
        { name: 'company', type: 'text', label: L('Firma', 'Company'), admin: { width: '33%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'photo', type: 'upload', relationTo: 'media', filterOptions: publicImageFilter, label: L('Fotoğraf', 'Photo'), admin: { width: '50%' } },
        { name: 'logo', type: 'upload', relationTo: 'media', filterOptions: publicImageFilter, label: L('Firma logosu', 'Company logo'), admin: { width: '50%' } },
      ],
    },
    blockSettings('testimonial'),
    blockMotion('testimonial'),
  ],
}
