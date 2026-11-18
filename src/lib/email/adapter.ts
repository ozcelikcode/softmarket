import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import type { EmailAdapter, Payload, SendEmailOptions } from 'payload'

import { DEFAULT_FROM_NAME, envDefinesSmtp, resolveSmtpConfig, type SmtpConfig } from '@/lib/integrations/runtime'
import { parseVault, readIntegrationsDoc } from '@/lib/integrations/vault'

/*
 * Runtime-configurable e-mail adapter. Payload builds its email adapter once at init, so instead of a fixed
 * nodemailer transport this adapter resolves the SMTP settings on EVERY send:
 *   env SMTP_HOST set (not `CHANGE_`)  → env settings (unchanged behaviour of existing installs)
 *   else integrations.smtp (admin panel, password decrypted in memory only)
 *   else not configured                 → Payload's console behaviour (one log line: recipient + subject, no body)
 * Transports are cached by the settings version (host/port/user/from/password record), so a change in the panel
 * takes effect on the next send without a restart; the old transport is closed. A settings read error throws
 * (callers such as the order notification queue retry); it never falls back to sending unauthenticated.
 */

type Send = (message: SendEmailOptions) => Promise<unknown>
export const SMTP_UNAVAILABLE = Symbol('smtp unavailable')
export type SmtpOnlyEmail = SendEmailOptions & { requireSmtp: true }
export type SenderFactory = (config: SmtpConfig, payload: Payload) => Promise<{ send: Send; close?: () => void }>
export type AdapterOptions = {
  env?: Record<string, string | undefined>
  /** Test seam: builds a sender for a config (default: @payloadcms/email-nodemailer with the config's SMTP). */
  createSender?: SenderFactory
  /** Test seam: settings loader (default: env, else the integrations global). */
  loadConfig?: (payload: Payload) => Promise<SmtpConfig | null>
}

/** Payload builds `from` for its auth e-mails from these defaults; the real address is decided at send time. */
export const PLACEHOLDER_FROM = 'noreply@softmarket.invalid'

const defaultSenderFactory: SenderFactory = async (config, payload) => {
  const adapter = await nodemailerAdapter({
    defaultFromAddress: config.fromAddress,
    defaultFromName: config.fromName,
    // No connection at creation (no network during init/tests); errors surface on send.
    skipVerify: true,
    transportOptions: {
      host: config.host, port: config.port, secure: config.secure,
      ...(config.user && config.password ? { auth: { user: config.user, pass: config.password.reveal() } } : {}),
    },
  })
  return { send: (message) => adapter({ payload }).sendEmail(message) }
}

export async function loadEmailConfig(payload: Payload, env: Record<string, string | undefined> = process.env): Promise<SmtpConfig | null> {
  if (envDefinesSmtp(env)) return resolveSmtpConfig(env, null)
  let doc: Record<string, unknown>
  try {
    doc = await readIntegrationsDoc(payload)
  } catch {
    throw new Error('email: settings unavailable')
  }
  const config = resolveSmtpConfig(env, doc)
  if (!config && parseVault(doc.secrets)['smtp.password']) throw new Error('email: SMTP credentials unavailable')
  return config
}

/** Whether order/notification e-mails can be sent right now (env or panel SMTP). Read errors → false. */
export async function isEmailConfigured(payload: Payload, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  try {
    return Boolean(await loadEmailConfig(payload, env))
  } catch {
    return false
  }
}

const recipients = (to: SendEmailOptions['to']): string => {
  const list: unknown[] = Array.isArray(to) ? to : to ? [to] : []
  return list.map((item) => (typeof item === 'string' ? item : String((item as { address?: unknown } | null)?.address ?? ''))).join(', ')
}

export function softmarketEmailAdapter(options: AdapterOptions = {}): EmailAdapter {
  const createSender = options.createSender ?? defaultSenderFactory
  let current: { version: string; sender: Promise<{ send: Send; close?: () => void }> } | null = null
  return ({ payload }) => ({
    name: 'softmarket-runtime-smtp',
    defaultFromAddress: PLACEHOLDER_FROM,
    defaultFromName: DEFAULT_FROM_NAME,
    sendEmail: async ({ requireSmtp, ...message }: SendEmailOptions & Partial<Pick<SmtpOnlyEmail, 'requireSmtp'>>) => {
      const config = options.loadConfig ? await options.loadConfig(payload) : await loadEmailConfig(payload, options.env ?? process.env)
      if (!config) {
        if (requireSmtp) return SMTP_UNAVAILABLE
        payload.logger.info({ msg: `Email attempted without being configured. To: '${recipients(message.to)}', Subject: '${String(message.subject ?? '')}'` })
        return
      }
      if (!current || current.version !== `${config.source}:${config.version}`) {
        const previous = current
        current = { version: `${config.source}:${config.version}`, sender: createSender(config, payload) }
        void previous?.sender.then((s) => s.close?.()).catch(() => undefined)
      }
      const sender = await current.sender.catch((error: unknown) => {
        current = null
        throw error
      })
      // Payload's own auth mails carry the placeholder sender: let the configured one apply.
      const rawFrom: unknown = message.from
      const from = typeof rawFrom === 'string' ? rawFrom : rawFrom && typeof rawFrom === 'object' && !Array.isArray(rawFrom) ? String((rawFrom as { address?: unknown }).address ?? '') : undefined
      return sender.send(from?.includes(PLACEHOLDER_FROM) ? { ...message, from: undefined } : message)
    },
  })
}
