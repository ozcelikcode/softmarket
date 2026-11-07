import { pbkdf2, randomInt } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import { after } from 'next/server'
import type { Payload } from 'payload'

import { resetEmailHTML, resetEmailSubject, verifyEmailHTML, verifyEmailSubject } from './email'

/** Equal work for absent/locked accounts; matches Payload 3.85's password KDF. */
export const dummyPasswordCheck = (password: string) => new Promise<void>((resolve, reject) => {
  pbkdf2(password, 'softmarket-enumeration-padding', 25000, 512, 'sha256', (error) => error ? reject(error) : resolve())
})

/** Hide fast duplicate/absent-account paths; SMTP runs outside the measured response. */
export async function authResponse<T>(work: () => Promise<T>): Promise<T> {
  const deadline = performance.now() + 800 + randomInt(101)
  try {
    return await work()
  } finally {
    await setTimeout(Math.max(0, deadline - performance.now()))
  }
}

export function queueAuthEmail(payload: Payload, user: { email: string; preferredLocale?: string | null }, token: string, kind: 'verify' | 'reset') {
  after(async () => {
    try {
      await payload.sendEmail({
        to: user.email,
        subject: kind === 'verify' ? verifyEmailSubject({ user }) : resetEmailSubject({ user }),
        html: kind === 'verify' ? verifyEmailHTML({ user, token }) : resetEmailHTML({ user, token }),
      })
    } catch {
      payload.logger.error('Portal authentication email delivery failed.')
    }
  })
}
