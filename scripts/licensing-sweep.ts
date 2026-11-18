import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { runLicensingSweep } from '../src/lib/licensing/rules/sweep'

/*
 * `pnpm licensing:sweep [--dry-run] [--retention]` (plan §5.3, systemd timer every 5 minutes): asynchronous licensing
 * rules, automatic suspensions (only in `suspend` mode after the observation window; never revocation), expiry events,
 * the durable notification queue and, in the nightly hour or with `--retention`, retention cleanup.
 * Idempotent; safe to run concurrently. `--dry-run` writes nothing and sends nothing.
 * Output: counts, rule keys, outcomes and numeric ids only (no IP, e-mail, license key or fingerprint). Exit 1 on errors.
 */
async function main() {
  const args = process.argv.slice(2)
  if (args.some((a) => a !== '--dry-run' && a !== '--retention')) throw new Error('Usage: pnpm licensing:sweep [--dry-run] [--retention]')
  const dryRun = args.includes('--dry-run')
  const payload = await getPayload({ config })
  try {
    const report = await runLicensingSweep(payload, { dryRun, retention: args.includes('--retention') ? true : 'auto' })
    console.log(`licensing:sweep${dryRun ? ' DRY RUN (no writes)' : ''}: licenses=${report.licenses} hits=${report.hits} `
      + `outcomes=${JSON.stringify(report.outcomes)} expired=${report.expired} queued=${report.queued} digest=${report.digest} errors=${report.errors}`)
    for (const a of report.actions) console.log(`  license=${a.license} rule=${a.rule} outcome=${a.outcome}${a.event ? ` event=${a.event}` : ''}`)
    if (report.notify) {
      const n = report.notify
      console.log(`  notify smtp=${n.smtp} claimed=${n.claimed} sent=${JSON.stringify(n.sent)} failed=${n.failed} deferred=${n.deferred} expired=${n.expired}`)
    }
    if (report.retention) console.log(`  retention ${JSON.stringify(report.retention)}`)
    return report.errors > 0 ? 1 : 0
  } finally {
    await payload.destroy()
  }
}

main().then((code) => process.exit(code)).catch(() => {
  console.error('licensing:sweep: failed')
  process.exit(1)
})
