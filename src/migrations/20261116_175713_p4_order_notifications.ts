import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`orders\` ADD \`notifications_confirmation_sent_at\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`notifications_license_sent_at\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`notifications_review_alert_sent_at\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`notifications_attempts\` numeric;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`notifications_last_error\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`notifications_next_attempt_at\` text;`)
  await db.run(sql`ALTER TABLE \`orders\` ADD \`notifications_lease_until\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Losing delivery markers can resend licence keys after a subsequent upgrade.
  const result = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM orders WHERE
    notifications_confirmation_sent_at IS NOT NULL OR notifications_license_sent_at IS NOT NULL OR
    notifications_review_alert_sent_at IS NOT NULL OR notifications_attempts IS NOT NULL OR
    notifications_last_error IS NOT NULL OR notifications_next_attempt_at IS NOT NULL OR notifications_lease_until IS NOT NULL`)
  if (Number(result[0]?.n) > 0) throw new Error('p4_order_notifications down refused: notification state exists.')
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`notifications_confirmation_sent_at\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`notifications_license_sent_at\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`notifications_review_alert_sent_at\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`notifications_attempts\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`notifications_last_error\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`notifications_next_attempt_at\`;`)
  await db.run(sql`ALTER TABLE \`orders\` DROP COLUMN \`notifications_lease_until\`;`)
}
