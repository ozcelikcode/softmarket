import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`media\` ADD \`seed_path\` text;`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_seed_path_idx\` ON \`media\` (\`seed_path\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX \`media_seed_path_idx\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`seed_path\`;`)
}
