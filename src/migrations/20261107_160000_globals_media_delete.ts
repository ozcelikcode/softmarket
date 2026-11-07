import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

/** Clear F7's nullable media references before a media row is deleted. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql.raw(`CREATE TRIGGER globals_media_delete BEFORE DELETE ON media BEGIN
    UPDATE site_settings SET favicon_id = NULL WHERE favicon_id = OLD.id;
    UPDATE header_nav_items SET featured_image_id = NULL WHERE featured_image_id = OLD.id;
  END;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TRIGGER globals_media_delete;`)
}
