import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE UNIQUE INDEX releases_product_version_unique ON releases (product_id, version)`)
  await db.run(sql`CREATE TRIGGER docs_slug_insert BEFORE INSERT ON docs_locales WHEN NEW.slug IS NOT NULL AND EXISTS (SELECT 1 FROM docs_locales l JOIN docs d ON d.id=l._parent_id JOIN docs n ON n.id=NEW._parent_id WHERE l.slug=NEW.slug AND l._locale=NEW._locale AND d.product_id=n.product_id AND l._parent_id<>NEW._parent_id) BEGIN SELECT RAISE(ABORT, 'duplicate product locale slug'); END`)
  await db.run(sql`CREATE TRIGGER docs_slug_update BEFORE UPDATE OF slug, _locale, _parent_id ON docs_locales WHEN NEW.slug IS NOT NULL AND EXISTS (SELECT 1 FROM docs_locales l JOIN docs d ON d.id=l._parent_id JOIN docs n ON n.id=NEW._parent_id WHERE l.slug=NEW.slug AND l._locale=NEW._locale AND d.product_id=n.product_id AND l.id<>OLD.id) BEGIN SELECT RAISE(ABORT, 'duplicate product locale slug'); END`)
  await db.run(sql`CREATE TRIGGER docs_product_update BEFORE UPDATE OF product_id ON docs WHEN NEW.product_id IS NOT NULL AND EXISTS (SELECT 1 FROM docs_locales a JOIN docs_locales b ON a.slug=b.slug AND a._locale=b._locale JOIN docs d ON d.id=b._parent_id WHERE a._parent_id=NEW.id AND b._parent_id<>NEW.id AND d.product_id=NEW.product_id) BEGIN SELECT RAISE(ABORT, 'duplicate product locale slug'); END`)
  await db.run(sql`CREATE TRIGGER ticket_message_touch AFTER INSERT ON support_ticket_messages BEGIN UPDATE support_tickets SET last_message_at = CASE WHEN last_message_at IS NULL OR last_message_at < NEW.created_at THEN NEW.created_at ELSE last_message_at END, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id=NEW.ticket_id AND status <> 'closed'; SELECT CASE WHEN changes()=0 THEN RAISE(ABORT, 'Cannot append to a closed or missing ticket') END; END`)
  await db.run(sql`CREATE TRIGGER ticket_delete_messages BEFORE DELETE ON support_tickets BEGIN DELETE FROM support_ticket_messages WHERE ticket_id=OLD.id; END`)
  await db.run(sql`CREATE TRIGGER media_keep_protected BEFORE UPDATE OF protected ON media WHEN OLD.protected=1 AND NEW.protected<>1 BEGIN SELECT RAISE(ABORT, 'Protected media cannot be unprotected'); END`)
  await db.run(sql`CREATE TRIGGER download_protected_insert BEFORE INSERT ON downloads WHEN NOT EXISTS (SELECT 1 FROM media WHERE id=NEW.file_id AND protected=1) BEGIN SELECT RAISE(ABORT, 'Download media must be protected'); END`)
  await db.run(sql`CREATE TRIGGER download_protected_update BEFORE UPDATE OF file_id ON downloads WHEN NOT EXISTS (SELECT 1 FROM media WHERE id=NEW.file_id AND protected=1) BEGIN SELECT RAISE(ABORT, 'Download media must be protected'); END`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const name of ['download_protected_update','download_protected_insert','media_keep_protected','ticket_delete_messages','ticket_message_touch','docs_product_update','docs_slug_update','docs_slug_insert']) await db.run(sql.raw(`DROP TRIGGER ${name}`))
  await db.run(sql`DROP INDEX releases_product_version_unique`)
}
