import type { GlobalConfig } from 'payload'

import { anyone, isAdminOrEditor } from '@/access'
import { linkField } from '@/fields/link'

/*
 * F7: fields are append-only. Existing names/options/defaults (navItems, megaMenu
 * products|solutions, children, cta.link) are unchanged so stored rows render as before.
 */
export const Header: GlobalConfig = {
  slug: 'header',
  label: { tr: 'Üst menü', en: 'Header' },
  admin: { group: 'Site' },
  access: { read: anyone, update: isAdminOrEditor },
  fields: [
    {
      name: 'navItems',
      type: 'array',
      maxRows: 8,
      label: { tr: 'Menü öğeleri', en: 'Navigation items' },
      fields: [
        linkField(),
        {
          name: 'megaMenu',
          type: 'select',
          label: { tr: 'Mega menü', en: 'Mega menu' },
          admin: {
            description: {
              tr: 'Otomatik (ürün/çözüm) ya da özel kolonlu mega menü. Boşsa alt bağlantılar açılır menü olur.',
              en: 'Automatic (products/solutions) or custom column mega menu. Empty: children become a dropdown.',
            },
          },
          options: [
            { label: { tr: 'Ürün aileleri → ürünler', en: 'Product families → products' }, value: 'products' },
            { label: { tr: 'Çözümler', en: 'Solutions & industries' }, value: 'solutions' },
            { label: { tr: 'Özel (kolonlar + öne çıkan kart)', en: 'Custom (columns + featured card)' }, value: 'custom' },
          ],
        },
        {
          name: 'children',
          type: 'array',
          label: { tr: 'Alt bağlantılar', en: 'Children' },
          admin: { condition: (_, sibling) => sibling?.megaMenu !== 'custom' },
          fields: [linkField(), { name: 'description', type: 'text', localized: true }],
        },
        {
          name: 'columns',
          type: 'array',
          maxRows: 4,
          label: { tr: 'Mega menü kolonları', en: 'Mega menu columns' },
          admin: { condition: (_, sibling) => sibling?.megaMenu === 'custom' },
          fields: [
            { name: 'title', type: 'text', localized: true, label: { tr: 'Kolon başlığı', en: 'Column title' } },
            {
              name: 'links',
              type: 'array',
              maxRows: 8,
              label: { tr: 'Bağlantılar', en: 'Links' },
              fields: [linkField(), { name: 'description', type: 'text', localized: true, label: { tr: 'Açıklama', en: 'Description' } }],
            },
          ],
        },
        {
          name: 'featured',
          type: 'group',
          label: { tr: 'Öne çıkan kart', en: 'Featured card' },
          admin: { condition: (_, sibling) => sibling?.megaMenu === 'custom' },
          fields: [
            { name: 'title', type: 'text', localized: true, label: { tr: 'Başlık', en: 'Title' } },
            { name: 'description', type: 'textarea', localized: true, label: { tr: 'Açıklama', en: 'Description' } },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              label: { tr: 'Görsel (herkese açık)', en: 'Image (public)' },
            },
            linkField({ name: 'link', label: 'Link' }),
          ],
        },
      ],
    },
    {
      name: 'cta',
      type: 'group',
      label: { tr: 'Butonlar', en: 'Buttons' },
      admin: { description: { tr: 'Birincil buton (ör. "Demo İste") ve opsiyonel ikinci buton.', en: 'Primary button (e.g. "Request a demo") and an optional second button.' } },
      fields: [
        linkField({ name: 'link' }),
        linkField({ name: 'secondary', label: 'Secondary' }),
      ],
    },
    {
      name: 'announcement',
      type: 'group',
      label: { tr: 'Duyuru bandı', en: 'Announcement bar' },
      fields: [
        { name: 'enabled', type: 'checkbox', defaultValue: false, label: { tr: 'Göster', en: 'Show' } },
        {
          name: 'text',
          type: 'text',
          localized: true,
          label: { tr: 'Metin', en: 'Text' },
          admin: { condition: (_, sibling) => Boolean(sibling?.enabled) },
        },
        {
          name: 'dismissible',
          type: 'checkbox',
          defaultValue: true,
          label: { tr: 'Ziyaretçi kapatabilir', en: 'Visitors can dismiss' },
          admin: {
            condition: (_, sibling) => Boolean(sibling?.enabled),
            description: { tr: 'Metin değişince band yeniden görünür.', en: 'The bar reappears when the text changes.' },
          },
        },
        linkField({ name: 'link', label: 'Link' }),
      ],
    },
    {
      name: 'utility',
      type: 'group',
      label: { tr: 'Yardımcı çubuk', en: 'Utility bar' },
      fields: [
        {
          name: 'links',
          type: 'array',
          maxRows: 4,
          label: { tr: 'Üst küçük bağlantılar', en: 'Small top links' },
          fields: [linkField()],
        },
        { name: 'showSearch', type: 'checkbox', defaultValue: true, label: { tr: 'Arama simgesi', en: 'Search icon' } },
        { name: 'showLanguage', type: 'checkbox', defaultValue: true, label: { tr: 'Dil değiştirici', en: 'Language switcher' } },
        { name: 'showAccount', type: 'checkbox', defaultValue: true, label: { tr: 'Müşteri hesabı', en: 'Customer account' } },
      ],
    },
  ],
}
