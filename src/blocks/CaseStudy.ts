import type { Block } from 'payload'

import { blockMotion } from '@/fields/block-motion'
import { blockSettings } from '@/fields/block-settings'

import { L, blockMeta, opt } from './meta'

export const CaseStudy: Block = {
  slug: 'caseStudy',
  interfaceName: 'CaseStudyBlock',
  ...blockMeta('caseStudy', ['Öne çıkan vaka', 'Featured case study'], ['Öne çıkan vakalar', 'Featured case studies'], 'proof'),
  fields: [
    { name: 'eyebrow', type: 'text', localized: true, label: L('Üst başlık (eyebrow)', 'Eyebrow') },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'featured',
      label: L('Kaynak', 'Source'),
      options: [
        opt('featured', 'Öne çıkan vaka (yoksa en yeni)', 'Featured case (else newest)'),
        opt('latest', 'En yeni vaka', 'Newest case'),
        opt('manual', 'Elle seçilen vaka', 'Selected case'),
        opt('byIndustry', 'Sektöre göre', 'By industry'),
      ],
    },
    {
      name: 'caseStudy',
      type: 'relationship',
      relationTo: 'case-studies',
      maxDepth: 0,
      label: L('Vaka', 'Case study'),
      admin: { condition: (_, sibling) => sibling?.source === 'manual' },
    },
    {
      name: 'industry',
      type: 'relationship',
      relationTo: 'industries',
      maxDepth: 0,
      label: L('Sektör', 'Industry'),
      admin: { condition: (_, sibling) => sibling?.source === 'byIndustry' },
    },
    { name: 'showResults', type: 'checkbox', defaultValue: true, label: L('Sonuç metriklerini göster', 'Show result metrics') },
    {
      type: 'row',
      fields: [
        { name: 'showLink', type: 'checkbox', defaultValue: true, label: L('Vaka bağlantısı', 'Case link'), admin: { width: '25%' } },
        {
          name: 'linkLabel',
          type: 'text',
          localized: true,
          label: L('Bağlantı metni', 'Link label'),
          admin: { width: '35%', condition: (_, sibling) => sibling?.showLink !== false, description: L('Boşsa "Ayrıntılar".', 'Empty uses "Learn more".') },
        },
        {
          name: 'linkUrl',
          type: 'text',
          label: L('Bağlantı adresi', 'Link URL'),
          admin: { width: '40%', condition: (_, sibling) => sibling?.showLink !== false, description: L('Boşsa vakanın kendi sayfası.', "Empty links to the case study's own page.") },
        },
      ],
    },
    blockSettings('caseStudy'),
    blockMotion('caseStudy'),
  ],
}
