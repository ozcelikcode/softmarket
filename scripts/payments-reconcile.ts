import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { reconcileOrders } from '../src/lib/payments/reconcile'
import { loadPaymentsDeps, paymentsLogger } from '../src/lib/payments/runtime'

/*
 * `pnpm payments:reconcile [--dry-run] [--limit=N]` — completes or cancels pending orders from the provider's truth
 * and retries crashed fulfilments (plan §3). Idempotent; safe to run from the systemd timer every 15 minutes.
 * Output: order numbers, actions and short codes only (no buyer data). Exit 1 when any order errored.
 */
async function main() {
  const args = process.argv.slice(2)
  const limitArg = args.find((a) => a.startsWith('--limit='))
  if (args.some((a) => a !== '--dry-run' && a !== limitArg)) throw new Error('Usage: pnpm payments:reconcile [--dry-run] [--limit=N]')
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : undefined
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 1000)) throw new Error('--limit must be 1..1000')
  const dryRun = args.includes('--dry-run')
  const payload = await getPayload({ config })
  const tasks: Promise<void>[] = []
  const log = paymentsLogger(payload)
  try {
    const deps = await loadPaymentsDeps(payload, {
      log,
      // No request context in the CLI: post-commit e-mails start at once and are awaited before exit.
      defer: (task) => void tasks.push(task().catch(() => log.error('post-commit task failed'))),
    })
    const report = await reconcileOrders(deps, { dryRun, limit })
    await Promise.allSettled(tasks)
    if (report.skipped) {
      console.log(`payments:reconcile skipped (${report.skipped})`)
      return 0
    }
    const counts = report.actions.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.action]: (acc[a.action] ?? 0) + 1 }), {})
    console.log(`payments:reconcile${dryRun ? ' DRY RUN (no writes)' : ''}: ${JSON.stringify(counts)} errors=${report.errors}`)
    for (const a of report.actions) if (a.action !== 'none') console.log(`  ${a.orderNumber} ${a.action} ${a.detail}`)
    return report.errors > 0 ? 1 : 0
  } finally {
    await payload.destroy()
  }
}

main().then((code) => process.exit(code)).catch(() => {
  console.error('payments:reconcile: failed')
  process.exit(1)
})
