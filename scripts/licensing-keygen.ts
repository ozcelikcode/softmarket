import 'dotenv/config'

import { getPayload, type SanitizedConfig } from 'payload'
import { LicensingKeyError, provisionSigningKey } from '../src/lib/licensing/signing'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.some((arg) => arg !== '--rotate' && arg !== '--register-env') || new Set(args).size !== args.length) {
    throw new Error('invalid_arguments')
  }
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config: config.then((settings) => ({
    ...settings,
    // Payload's sanitized type requires every optional Pino option.
    logger: { options: { level: 'silent' } } as SanitizedConfig['logger'],
  })) })
  try {
    const key = await provisionSigningKey(payload, { rotate: args.includes('--rotate'), registerEnv: args.includes('--register-env') })
    process.stdout.write(JSON.stringify(key) + '\n')
  } finally {
    await payload.destroy()
  }
}

try {
  await main()
} catch (error) {
  const code = error instanceof LicensingKeyError ? error.code
    : error instanceof Error && error.message === 'invalid_arguments' ? 'invalid_arguments' : 'keygen_failed'
  process.stderr.write(`licensing:keygen ${code}\n`)
  process.exit(1)
}
// Payload plugins may keep background timers after the DB connection closes.
process.exit(0)
