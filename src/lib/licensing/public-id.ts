import { randomBytes } from 'node:crypto'

import { PUBLIC_ID_RE } from './constants'

/**
 * Opaque public identifier for licenses and activations (API `lic_…` / `act_…`), so sequential DB ids never leave
 * the server. The migration backfill and new licenses use 12 CSPRNG bytes encoded as lowercase hex.
 * Not a credential: knowing it grants nothing (requests are authenticated by the device key, plan §1.1).
 */
export const generatePublicId = (random: (size: number) => Uint8Array = randomBytes): string =>
  Buffer.from(random(12)).toString('hex')

export const isPublicId = (value: unknown): value is string => typeof value === 'string' && PUBLIC_ID_RE.test(value)
