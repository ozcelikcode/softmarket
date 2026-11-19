import type { Field, GlobalConfig, PayloadRequest } from 'payload'

import { isPanelAdmin, nobodyField } from '@/access'
import { SECRET_IDS, SECRET_LABELS, type SecretId } from '@/lib/integrations/ids'

/*
 * Integration settings entered in the admin panel: payment provider keys (sandbox + live), SMTP account.
 *
 * Separate global (not site-settings): site-settings is publicly readable and carries public content; this one is
 * admin-only, has NO versions/drafts (no `_v` table that could keep old values), is not in the MCP allow-list and is
 * never revalidated. Secrets are write-only:
 *   - stored only as AES-256-GCM ciphertext in the `secrets` JSON column (src/lib/secrets/crypto.ts);
 *   - field access read/create/update = nobody → never in REST/GraphQL/Local API output (without overrideAccess),
 *     never in the admin form state or autosave;
 *   - written only through POST /api/globals/integrations/secret (admin panel session, src/lib/integrations/endpoints.ts);
 *   - displayed only as "set · last 4 · updated at" by a `ui` server component.
 * Env always wins (src/lib/integrations/runtime.ts); `PAYMENTS_ENABLED` and `NEXT_PUBLIC_SERVER_URL` stay server-side.
 * Writes need an admin PANEL session: a users API key (MCP) can neither read nor change anything here.
 */

const L = (tr: string, en: string) => ({ tr, en })
const noImport = { contentImport: false }
const bilingual = (tr: string, en: string) => `${tr} / ${en}`

const secretField = (id: SecretId): Field => ({
  name: `secret_${id.replace(/\./g, '_')}`,
  type: 'ui',
  label: SECRET_LABELS[id],
  admin: {
    components: { Field: { path: '@/admin/fields/integration-secret#IntegrationSecret', serverProps: { secretId: id } } },
  },
})

const environmentFields = (provider: 'iyzico' | 'stripe'): Field[] => [
  {
    name: 'environment',
    type: 'select',
    defaultValue: 'sandbox',
    required: true,
    label: L('Ortam', 'Environment'),
    options: [
      { label: L('Test (sandbox)', 'Test (sandbox)'), value: 'sandbox' },
      { label: L('Canlı', 'Live'), value: 'live' },
    ],
    admin: {
      description: L(
        'Seçilen ortamın anahtarları kullanılır; API adresi bu seçimden gelir (serbest adres girilemez). Canlıya geçiş ek onay ister.',
        'The keys of the selected environment are used; the API address follows this choice (no free-form URL). Switching to live needs an extra confirmation.',
      ),
    },
    validate: (value: unknown, { previousValue, siblingData }: { previousValue?: unknown; siblingData?: Record<string, unknown> }) =>
      value !== 'live' || previousValue === 'live' || siblingData?.confirmLive === true
        ? true
        : bilingual('Canlı ortama geçmek için "Canlı ortamı onaylıyorum" kutusunu işaretleyin.', 'Tick "I confirm the live environment" to switch to live.'),
  },
  {
    // Virtual: never stored. Required once for each switch to live.
    name: 'confirmLive',
    type: 'checkbox',
    virtual: true,
    label: L('Canlı ortamı onaylıyorum (gerçek kartlardan tahsilat yapılır)', 'I confirm the live environment (real cards are charged)'),
    admin: { condition: (_, sibling) => sibling?.environment === 'live' },
  },
  ...SECRET_IDS.filter((id) => id.startsWith(`${provider}.`)).map(secretField),
]

export const Integrations: GlobalConfig = {
  slug: 'integrations',
  label: L('Entegrasyon ayarları', 'Integration settings'),
  admin: {
    group: 'Admin',
    description: L(
      'Ödeme sağlayıcısı anahtarları ve SMTP hesabı. Gizli değerler şifreli saklanır ve hiçbir yerde geri gösterilmez; sunucu ortam değişkeni tanımlıysa o kullanılır.',
      'Payment provider keys and the SMTP account. Secret values are stored encrypted and never shown again; a server environment variable, when set, takes precedence.',
    ),
  },
  access: { read: isPanelAdmin, update: isPanelAdmin, readVersions: () => false },
  endpoints: [
    {
      path: '/secret',
      method: 'post',
      handler: async (req: PayloadRequest) => (await import('@/lib/integrations/endpoints')).handleSecretWrite(req),
    },
    {
      path: '/test-email',
      method: 'post',
      handler: async (req: PayloadRequest) => (await import('@/lib/integrations/endpoints')).handleTestEmail(req),
    },
  ],
  fields: [
    {
      name: 'serverStatus',
      type: 'ui',
      admin: { components: { Field: '@/admin/fields/integrations-status#IntegrationsStatus' } },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: L('Ödeme sağlayıcıları', 'Payment providers'),
          fields: [
            {
              name: 'iyzico',
              type: 'group',
              label: L('iyzico', 'iyzico'),
              custom: noImport,
              fields: environmentFields('iyzico'),
            },
            {
              name: 'stripe',
              type: 'group',
              label: L('Stripe', 'Stripe'),
              custom: noImport,
              admin: {
                description: L(
                  'Yalnız sunucu izin verirse (PAYMENTS_STRIPE_ENABLED=true) kullanılır; Stripe Türkiye merkezli şirketlere hizmet vermez.',
                  'Used only with PAYMENTS_STRIPE_ENABLED=true on the server (Stripe does not serve companies based in Türkiye).',
                ),
              },
              fields: environmentFields('stripe'),
            },
          ],
        },
        {
          label: L('E-posta (SMTP)', 'E-mail (SMTP)'),
          fields: [
            {
              name: 'smtp',
              type: 'group',
              label: L('SMTP hesabı', 'SMTP account'),
              custom: noImport,
              admin: {
                description: L(
                  'Önce sunucu, port, kullanıcı ve gönderen adresini kaydedin, sonra şifreyi girin. Sunucu veya kullanıcı değişirse kayıtlı şifre geçersiz olur ve yeniden girilmelidir.',
                  'Save host, port, user and sender first, then enter the password. Changing the host or user invalidates the stored password; enter it again.',
                ),
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'host', type: 'text', label: L('Sunucu (host)', 'Host'), admin: { placeholder: 'smtp.example.com' },
                      validate: (value: unknown) => !value || (typeof value === 'string' && /^[A-Za-z0-9.-]{1,253}$/.test(value.trim()))
                        ? true : bilingual('Geçerli bir sunucu adı girin.', 'Enter a valid host name.') },
                    { name: 'port', type: 'number', defaultValue: 587, min: 1, max: 65535, label: L('Port', 'Port') },
                    { name: 'secure', type: 'checkbox', defaultValue: false, label: L('Doğrudan TLS (465)', 'Implicit TLS (465)') },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'user', type: 'text', label: L('Kullanıcı adı', 'Username') },
                    { name: 'fromAddress', type: 'email', label: L('Gönderen adresi', 'From address') },
                    { name: 'fromName', type: 'text', label: L('Gönderen adı', 'From name'), admin: { placeholder: 'SoftMarket' } },
                  ],
                },
                secretField('smtp.password'),
                {
                  name: 'testEmail',
                  type: 'ui',
                  admin: { components: { Field: '@/admin/fields/integration-test-email#IntegrationTestEmail' } },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      // AES-256-GCM records only (src/lib/integrations/vault.ts). Nobody reads or writes it through the API.
      name: 'secrets',
      type: 'json',
      access: { read: nobodyField, create: nobodyField, update: nobodyField },
      admin: { hidden: true, disableListColumn: true },
      custom: noImport,
    },
  ],
}
