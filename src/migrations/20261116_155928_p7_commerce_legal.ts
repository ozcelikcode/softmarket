import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`pages\` ADD \`commerce_legal\` text;`)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_commerce_legal_idx\` ON \`pages\` (\`commerce_legal\`);`)
  await db.run(sql`ALTER TABLE \`_pages_v\` ADD \`version_commerce_legal\` text;`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_commerce_legal_idx\` ON \`_pages_v\` (\`version_commerce_legal\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX \`pages_commerce_legal_idx\`;`)
  await db.run(sql`ALTER TABLE \`pages\` DROP COLUMN \`commerce_legal\`;`)
  await db.run(sql`DROP INDEX \`_pages_v_version_version_commerce_legal_idx\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v\` DROP COLUMN \`version_commerce_legal\`;`)
}
