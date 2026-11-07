import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

/** F4's added video foreign keys lack ON DELETE SET NULL. Preserve hero children without rebuilding tables. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const updates = ['products', 'solutions', 'case_studies', 'pages'].flatMap((root) =>
    [root, `_${root}_v`].map((prefix) =>
      `UPDATE "${prefix}_blocks_hero" SET video_id = NULL WHERE video_id = OLD.id;`,
    ),
  ).join('\n')
  await db.run(sql.raw(`CREATE TRIGGER hero_video_delete BEFORE DELETE ON media BEGIN ${updates} END;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TRIGGER hero_video_delete;`)
}
