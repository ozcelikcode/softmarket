import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`customers\` ADD \`kvkk_consent_at\` text;`)
  await db.run(sql`ALTER TABLE \`customers\` ADD \`kvkk_consent_version\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`customers\` DROP COLUMN \`kvkk_consent_at\`;`)
  await db.run(sql`ALTER TABLE \`customers\` DROP COLUMN \`kvkk_consent_version\`;`)
}
