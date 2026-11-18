import { Forbidden, type Field, type GlobalConfig } from 'payload'

import { isPanelAdmin, nobody, nobodyField } from '@/access'
import { adminAction } from '@/lib/licensing/admin/routes'
import { auditLicensingSettings } from '@/lib/licensing/admin/settings-audit'
import { hiddenUnlessAdmin, options } from '@/lib/licensing/collection-helpers'
import { validSigningKeyRows } from '@/lib/licensing/crypto/keys'
import { previewOrigin } from '@/lib/preview-url'
import {
  COUNTRY_SOURCES,
  LICENSING_RULE_KEYS,
  MAX_LEASE_DAYS,
  RETENTION_FLOORS,
  RULE_DEFAULTS,
  RULE_MODES,
  SECURITY_SEVERITIES,
  type LicensingRuleKey,
} from '@/lib/licensing/constants'

/*
 * Licensing settings (plan §4.8): panel admins read and edit non-secret settings.
 * No versions, document locks, GraphQL, MCP, public revalidation or content import.
 *
 * Safe defaults for the user decisions (2026-11-17):
 *   - The API is off (`apiEnabled = false`) until the operator turns it on.
 *   - Automatic rules start in `notify` (event + admin e-mail, no suspension). There is no `revoke` mode at all.
 *     The license transition hook requires `suspend` mode and a past `rules.observeUntil` for rule suspensions.
 *   - Seats are counted per active device (`licenses.maxDevices`, empty = `seats`).
 * Signing keys are listed read-only (public key + kid); the private key never lives here (vault, L2).
 * L6b: a panel admin's save writes one `settings.update` audit row (src/lib/licensing/admin/settings-audit.ts); the
 * signing key is generated/rotated only through POST /api/globals/licensing-settings/rotate-signing-key.
 */

const noImport = { contentImport: false }

const int = (name: string, defaultValue: number, min: number, max: number): Field => ({
  name,
  type: 'number',
  required: true,
  defaultValue,
  min,
  max,
  validate: (value: unknown) =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
      ? true
      : `${min}-${max} arası tam sayı. / Whole number between ${min} and ${max}.`,
})

const ruleGroup = (key: LicensingRuleKey): Field => ({
  name: key,
  type: 'group',
  fields: [
    { name: 'mode', type: 'select', required: true, defaultValue: 'notify', options: options(RULE_MODES) },
    int('threshold', RULE_DEFAULTS[key].threshold, 1, 10_000),
    int('windowHours', RULE_DEFAULTS[key].windowHours, 1, 24 * 90),
    int('suppressDays', 30, 0, 365),
  ],
})

export const LicensingSettings: GlobalConfig = {
  slug: 'licensing-settings',
  admin: { group: 'Security', hidden: hiddenUnlessAdmin },
  access: { read: isPanelAdmin, update: isPanelAdmin, readVersions: nobody },
  hooks: {
    // Apply CSRF checks to writes. Payload also calls access.update during read-only permission discovery.
    beforeOperation: [({ operation, overrideAccess, req }) => {
      if (operation !== 'update' || overrideAccess) return
      const site = req.headers.get('sec-fetch-site')
      const host = req.headers.get('host')
      const origin = req.headers.get('origin')
      // Behind Caddy, Next can use an internal URL. Use the configured panel origin in
      // that case. A Host or forwarded header alone cannot establish the public origin.
      const panelOrigin = new URL(previewOrigin({ host: host ?? '', headers: req.headers }))
      const expected = panelOrigin.host === host ? panelOrigin : new URL(req.origin)
      if (req.payloadAPI !== 'REST' || (site !== null && site !== 'same-origin') || !host
        || host !== expected.host || origin !== expected.origin) throw new Forbidden(req.t)
    }],
    afterChange: [auditLicensingSettings],
  },
  endpoints: [adminAction('/rotate-signing-key', 'signing-key.rotate')],
  graphQL: false,
  lockDocuments: false,
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
          fields: [
            { name: 'apiEnabled', type: 'checkbox', defaultValue: false, custom: noImport },
            { name: 'publicHost', type: 'text', maxLength: 253, custom: noImport,
              validate: (value: unknown) => value === null || value === undefined || value === ''
                || (typeof value === 'string' && /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value))
                ? true
                : 'Yalnız alan adı (ör. lisans.ornek.com). / Host name only (e.g. licensing.example.com).' },
            { ...int('refreshHours', 24, 1, 168), custom: noImport } as Field,
            { ...int('leaseDays', 14, 1, MAX_LEASE_DAYS), custom: noImport } as Field,
            { ...int('clockSkewSeconds', 300, 60, 900), custom: noImport } as Field,
            { ...int('seenWriteMinutes', 60, 1, 1440), custom: noImport } as Field,
            { name: 'countrySource', type: 'select', required: true, defaultValue: 'none', options: options(COUNTRY_SOURCES), custom: noImport },
          ],
        },
        {
          label: 'Limits',
          fields: [
            {
              name: 'limits',
              type: 'group',
              custom: noImport,
              fields: [
                int('ipPrefixPerMinute', 60, 1, 10_000),
                int('invalidLicensePerIpPerHour', 10, 1, 1000),
                int('ipBlockFirstHours', 1, 1, 168),
                int('ipBlockRepeatHours', 24, 1, 720),
                int('activationsPerLicensePerDay', 10, 1, 1000),
                int('requestsPerActivationPerHour', 30, 1, 10_000),
                int('badSignaturesPerActivationPerHour', 5, 1, 1000),
                int('globalPerSecond', 200, 1, 100_000),
              ],
            },
          ],
        },
        {
          label: 'Rules',
          fields: [
            {
              name: 'rules',
              type: 'group',
              custom: noImport,
              fields: [
                { name: 'observeUntil', type: 'date' },
                int('maxAutoSuspendsPerHour', 5, 0, 100),
                ...LICENSING_RULE_KEYS.map(ruleGroup),
              ],
            },
          ],
        },
        {
          label: 'Self-service',
          fields: [
            {
              name: 'selfService',
              type: 'group',
              custom: noImport,
              fields: [
                int('portalDeactivationsPer30Days', 3, 0, 50),
                int('rebindsPer30Days', 3, 0, 50),
              ],
            },
          ],
        },
        {
          label: 'Notifications',
          fields: [
            {
              name: 'notifications',
              type: 'group',
              custom: noImport,
              fields: [
                { name: 'alertEmails', type: 'array', maxRows: 10, fields: [{ name: 'email', type: 'email', required: true }] },
                { name: 'minSeverityImmediate', type: 'select', required: true, defaultValue: 'high', options: options(SECURITY_SEVERITIES) },
                { name: 'dailyDigest', type: 'checkbox', defaultValue: false },
                int('digestHour', 8, 0, 23),
                { name: 'customerSuspensionEmail', type: 'checkbox', defaultValue: true },
              ],
            },
          ],
        },
        {
          label: 'Retention',
          fields: [
            {
              name: 'retention',
              type: 'group',
              custom: noImport,
              fields: [
                int('eventIpDays', 30, RETENTION_FLOORS.eventIpDays, 365),
                int('eventDays', 180, RETENTION_FLOORS.eventDays, 3650),
                int('activationIpDays', 90, RETENTION_FLOORS.activationIpDays, 365),
                int('activationRowYears', 2, RETENTION_FLOORS.activationRowYears, 20),
                int('blockDays', 90, RETENTION_FLOORS.blockDays, 3650),
                int('statusLogYears', 10, RETENTION_FLOORS.statusLogYears, 30),
                int('auditYears', 2, RETENTION_FLOORS.auditYears, 20),
              ],
            },
          ],
        },
        {
          label: 'Signing keys',
          fields: [
            {
              // L6b "generate / rotate" (typed confirmation, admin panel session; private key never shown).
              name: 'signingKeyActions',
              type: 'ui',
              label: { tr: 'İmza anahtarı işlemleri', en: 'Signing key actions' },
              admin: { components: { Field: '@/admin/fields/signing-key-rotate#SigningKeyRotate' } },
            },
            {
              // Public metadata written by the signing key lifecycle service.
              name: 'signingKeys',
              type: 'array',
              custom: noImport,
              validate: (rows) => rows == null || (Array.isArray(rows) && validSigningKeyRows(rows))
                || 'Invalid signing key metadata.',
              access: { create: nobodyField, update: nobodyField },
              admin: { readOnly: true },
              fields: [
                { name: 'kid', type: 'text', required: true },
                { name: 'publicKey', type: 'text', required: true },
                { name: 'createdAt', type: 'date', required: true },
                { name: 'retiredAt', type: 'date' },
                { name: 'revokedAt', type: 'date' },
              ],
            },
          ],
        },
      ],
    },
  ],
}
