import 'dotenv/config'
import { resolve, dirname } from 'node:path'
import { stat } from 'node:fs/promises'
import { createLocalReq, getPayload } from 'payload'
import { convertMarkdownToLexical, defaultEditorConfig, sanitizeServerEditorConfig } from '@payloadcms/richtext-lexical'
import config from '../src/payload.config'
import { importContent, loadLegal, loadSources } from '../src/lib/content-import/importer'
import { withImportTransaction } from '../src/lib/content-import/transaction'

async function main() {
  const args = process.argv.slice(2)
  if (args.some(a => a.startsWith('--') && !['--dry-run', '--legal'].includes(a))) throw new Error('Usage: pnpm content:import [directory|file.json] [--dry-run] [--legal]')
  const paths = args.filter(a => !a.startsWith('--'))
  if (paths.length > 1) throw new Error('Provide one seed path')
  const path = resolve(paths[0] ?? 'content/seed')
  const root = (await stat(path)).isDirectory() ? path : dirname(path)
  // Parse and validate every file before opening the DB.
  const sources = await loadSources(path)
  if (args.includes('--legal')) sources.push(await loadLegal(resolve('content/legal')))
  const payload = await getPayload({ config })
  const dryRun = args.includes('--dry-run')
  let interrupted = false
  const interrupt = () => { interrupted = true; console.error('Interrupt received; rolling back import…') }
  process.on('SIGINT', interrupt)
  process.on('SIGTERM', interrupt)
  const sendEmail = payload.sendEmail
  if (dryRun) payload.sendEmail = async () => { throw new Error('Email is disabled during dry-run') }
  try {
    const editorConfig = await sanitizeServerEditorConfig(defaultEditorConfig, payload.config)
    const req = await createLocalReq({}, payload)
    const work = async () => {
      const result = await importContent({ payload, sources, root, rollbackRun: dryRun, req,
      markdown: markdown => convertMarkdownToLexical({ editorConfig, markdown }),
      })
      if (interrupted) throw new Error('Import interrupted')
      return result
    }
    // Dry run = real writes (hooks, validation, slug checks) inside a transaction that is always rolled back.
    const result = await withImportTransaction(payload, req, work, { rollback: dryRun })
    console.log(`${dryRun ? 'DRY RUN (all writes rolled back)' : 'Committed'}: ${result.creates} created, ${result.updates} updated`)
  } finally {
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', interrupt)
    payload.sendEmail = sendEmail
    await payload.destroy()
  }
}
main().then(() => process.exit(0)).catch(error => {
  console.error(`content:import: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
