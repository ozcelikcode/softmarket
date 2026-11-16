import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/* P4 notification persistence: migration p4_order_notifications on a real temporary SQLite (data preserved). */
const NAME = '20261116_175713_p4_order_notifications'
const COLUMNS = ['attempts', 'confirmation_sent_at', 'last_error', 'lease_until', 'license_sent_at', 'next_attempt_at', 'review_alert_sent_at'].map((c) => `orders.notifications_${c}`)
let payload: Payload
let dir: string
const run = (q: string) => payload.db.drizzle.$client.execute(q)
type Migration = { name: string; up: (a: never) => Promise<void>; down: (a: never) => Promise<void> }
type MigrateArgs = NonNullable<Parameters<Payload['db']['migrate']>[0]>['migrations']
let migration: Migration
const args = () => ({ db: payload.db.drizzle, payload, req: {} }) as never

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-p4n-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  const { migrations } = (await import('../../src/migrations')) as unknown as { migrations: Migration[] }
  const index = migrations.findIndex((m) => m.name === NAME)
  expect(index).toBeGreaterThanOrEqual(0)
  migration = migrations[index]
  await payload.db.migrate({ migrations: migrations.slice(0, index) as unknown as MigrateArgs })
  await run(`INSERT INTO orders(id,order_number,status,currency,subtotal_minor,vat_minor,total_minor,provider,idempotency_key,billing_type,billing_name,billing_email)
    VALUES(1,'SM-261116-AAAAAA','fulfilled','TRY',100,20,120,'iyzico','idem-migration-0001','individual','Ad','a@example.test')`)
}, 240000)
afterAll(async () => {
  await payload?.destroy()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe(`migration ${NAME}`, () => {
  it('up() only adds nullable columns; down() drops only them and keeps every row', async () => {
    const source = readFileSync(join(process.cwd(), 'src/migrations', `${NAME}.ts`), 'utf8')
    const [up, down] = source.split('export async function down')
    expect(up).not.toMatch(/DROP |DELETE FROM|__new_|RENAME|PRAGMA|INSERT INTO|UPDATE `|NOT NULL/)
    expect(down).not.toMatch(/__new_|INSERT INTO|RENAME|DELETE FROM|CREATE TABLE/)
    expect([...up.matchAll(/ALTER TABLE \\`(\w+)\\` ADD \\`(\w+)\\`/g)].map((m) => `${m[1]}.${m[2]}`).sort()).toEqual(COLUMNS)

    const snapshot = async () => (await run('SELECT * FROM orders')).rows.map((r) => ({ ...r }))
    const before = await snapshot()
    await migration.up(args())
    const after = await snapshot()
    expect(after.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('notifications_'))))).toEqual(before)
    for (const column of COLUMNS) expect(after[0]![column.slice('orders.'.length)]).toBeNull()
    await run("UPDATE orders SET notifications_license_sent_at = '2026-11-16T00:00:00.000Z' WHERE id = 1")
    await expect(migration.down(args())).rejects.toThrow('notification state exists')
    expect((await run('SELECT notifications_license_sent_at FROM orders WHERE id = 1')).rows[0]?.notifications_license_sent_at).toBe('2026-11-16T00:00:00.000Z')
    await run('UPDATE orders SET notifications_license_sent_at = NULL WHERE id = 1')
    await migration.down(args())
    expect(await snapshot()).toEqual(before)
    expect((await run('PRAGMA integrity_check')).rows[0]).toMatchObject({ integrity_check: 'ok' })
    await migration.up(args())
  }, 240000)
})
