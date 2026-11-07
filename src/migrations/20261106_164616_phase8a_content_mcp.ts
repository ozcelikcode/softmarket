import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`payload_mcp_api_keys\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`user_id\` integer NOT NULL,
  	\`label\` text,
  	\`description\` text,
  	\`product_families_find\` integer DEFAULT false,
  	\`product_families_create\` integer DEFAULT false,
  	\`product_families_update\` integer DEFAULT false,
  	\`product_families_delete\` integer DEFAULT false,
  	\`products_find\` integer DEFAULT false,
  	\`products_create\` integer DEFAULT false,
  	\`products_update\` integer DEFAULT false,
  	\`products_delete\` integer DEFAULT false,
  	\`editions_find\` integer DEFAULT false,
  	\`editions_create\` integer DEFAULT false,
  	\`editions_update\` integer DEFAULT false,
  	\`editions_delete\` integer DEFAULT false,
  	\`solutions_find\` integer DEFAULT false,
  	\`solutions_create\` integer DEFAULT false,
  	\`solutions_update\` integer DEFAULT false,
  	\`solutions_delete\` integer DEFAULT false,
  	\`industries_find\` integer DEFAULT false,
  	\`industries_create\` integer DEFAULT false,
  	\`industries_update\` integer DEFAULT false,
  	\`industries_delete\` integer DEFAULT false,
  	\`case_studies_find\` integer DEFAULT false,
  	\`case_studies_create\` integer DEFAULT false,
  	\`case_studies_update\` integer DEFAULT false,
  	\`case_studies_delete\` integer DEFAULT false,
  	\`posts_find\` integer DEFAULT false,
  	\`posts_create\` integer DEFAULT false,
  	\`posts_update\` integer DEFAULT false,
  	\`posts_delete\` integer DEFAULT false,
  	\`careers_find\` integer DEFAULT false,
  	\`careers_create\` integer DEFAULT false,
  	\`careers_update\` integer DEFAULT false,
  	\`careers_delete\` integer DEFAULT false,
  	\`partners_find\` integer DEFAULT false,
  	\`partners_create\` integer DEFAULT false,
  	\`partners_update\` integer DEFAULT false,
  	\`partners_delete\` integer DEFAULT false,
  	\`pages_find\` integer DEFAULT false,
  	\`pages_create\` integer DEFAULT false,
  	\`pages_update\` integer DEFAULT false,
  	\`pages_delete\` integer DEFAULT false,
  	\`docs_find\` integer DEFAULT false,
  	\`docs_create\` integer DEFAULT false,
  	\`docs_update\` integer DEFAULT false,
  	\`docs_delete\` integer DEFAULT false,
  	\`releases_find\` integer DEFAULT false,
  	\`releases_create\` integer DEFAULT false,
  	\`releases_update\` integer DEFAULT false,
  	\`releases_delete\` integer DEFAULT false,
  	\`downloads_find\` integer DEFAULT false,
  	\`downloads_create\` integer DEFAULT false,
  	\`downloads_update\` integer DEFAULT false,
  	\`downloads_delete\` integer DEFAULT false,
  	\`faqs_find\` integer DEFAULT false,
  	\`faqs_create\` integer DEFAULT false,
  	\`faqs_update\` integer DEFAULT false,
  	\`faqs_delete\` integer DEFAULT false,
  	\`media_find\` integer DEFAULT false,
  	\`media_create\` integer DEFAULT false,
  	\`media_update\` integer DEFAULT false,
  	\`media_delete\` integer DEFAULT false,
  	\`licenses_find\` integer DEFAULT false,
  	\`licenses_create\` integer DEFAULT false,
  	\`licenses_update\` integer DEFAULT false,
  	\`header_find\` integer DEFAULT false,
  	\`header_update\` integer DEFAULT false,
  	\`footer_find\` integer DEFAULT false,
  	\`footer_update\` integer DEFAULT false,
  	\`site_settings_find\` integer DEFAULT false,
  	\`site_settings_update\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`enable_a_p_i_key\` integer,
  	\`api_key\` text,
  	\`api_key_index\` text,
  	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_mcp_api_keys_user_idx\` ON \`payload_mcp_api_keys\` (\`user_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_mcp_api_keys_updated_at_idx\` ON \`payload_mcp_api_keys\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_mcp_api_keys_created_at_idx\` ON \`payload_mcp_api_keys\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`enable_a_p_i_key\` integer;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`api_key\` text;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`api_key_index\` text;`)
  await db.run(sql`ALTER TABLE \`faqs_locales\` ADD \`slug\` text;`)
  await db.run(sql`CREATE UNIQUE INDEX \`faqs_slug_idx\` ON \`faqs_locales\` (\`slug\`,\`_locale\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`payload_mcp_api_keys_id\` integer REFERENCES payload_mcp_api_keys(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_payload_mcp_api_keys_id_idx\` ON \`payload_locked_documents_rels\` (\`payload_mcp_api_keys_id\`);`)
  await db.run(sql`ALTER TABLE \`payload_preferences_rels\` ADD \`payload_mcp_api_keys_id\` integer REFERENCES payload_mcp_api_keys(id);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_payload_mcp_api_keys_id_idx\` ON \`payload_preferences_rels\` (\`payload_mcp_api_keys_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`payload_mcp_api_keys\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`customers_id\` integer,
  	\`product_families_id\` integer,
  	\`products_id\` integer,
  	\`editions_id\` integer,
  	\`solutions_id\` integer,
  	\`industries_id\` integer,
  	\`case_studies_id\` integer,
  	\`posts_id\` integer,
  	\`careers_id\` integer,
  	\`partners_id\` integer,
  	\`pages_id\` integer,
  	\`media_id\` integer,
  	\`docs_id\` integer,
  	\`releases_id\` integer,
  	\`downloads_id\` integer,
  	\`faqs_id\` integer,
  	\`support_tickets_id\` integer,
  	\`support_ticket_messages_id\` integer,
  	\`licenses_id\` integer,
  	\`forms_id\` integer,
  	\`form_submissions_id\` integer,
  	\`search_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`customers_id\`) REFERENCES \`customers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`product_families_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`editions_id\`) REFERENCES \`editions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`solutions_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`industries_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`case_studies_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`careers_id\`) REFERENCES \`careers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`partners_id\`) REFERENCES \`partners\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`docs_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`releases_id\`) REFERENCES \`releases\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`downloads_id\`) REFERENCES \`downloads\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`faqs_id\`) REFERENCES \`faqs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`support_tickets_id\`) REFERENCES \`support_tickets\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`support_ticket_messages_id\`) REFERENCES \`support_ticket_messages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`licenses_id\`) REFERENCES \`licenses\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`forms_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`form_submissions_id\`) REFERENCES \`form_submissions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`search_id\`) REFERENCES \`search\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "customers_id", "product_families_id", "products_id", "editions_id", "solutions_id", "industries_id", "case_studies_id", "posts_id", "careers_id", "partners_id", "pages_id", "media_id", "docs_id", "releases_id", "downloads_id", "faqs_id", "support_tickets_id", "support_ticket_messages_id", "licenses_id", "forms_id", "form_submissions_id", "search_id") SELECT "id", "order", "parent_id", "path", "users_id", "customers_id", "product_families_id", "products_id", "editions_id", "solutions_id", "industries_id", "case_studies_id", "posts_id", "careers_id", "partners_id", "pages_id", "media_id", "docs_id", "releases_id", "downloads_id", "faqs_id", "support_tickets_id", "support_ticket_messages_id", "licenses_id", "forms_id", "form_submissions_id", "search_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_customers_id_idx\` ON \`payload_locked_documents_rels\` (\`customers_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_product_families_id_idx\` ON \`payload_locked_documents_rels\` (\`product_families_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_products_id_idx\` ON \`payload_locked_documents_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_editions_id_idx\` ON \`payload_locked_documents_rels\` (\`editions_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_solutions_id_idx\` ON \`payload_locked_documents_rels\` (\`solutions_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_industries_id_idx\` ON \`payload_locked_documents_rels\` (\`industries_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_case_studies_id_idx\` ON \`payload_locked_documents_rels\` (\`case_studies_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_posts_id_idx\` ON \`payload_locked_documents_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_careers_id_idx\` ON \`payload_locked_documents_rels\` (\`careers_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_partners_id_idx\` ON \`payload_locked_documents_rels\` (\`partners_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_docs_id_idx\` ON \`payload_locked_documents_rels\` (\`docs_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_releases_id_idx\` ON \`payload_locked_documents_rels\` (\`releases_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_downloads_id_idx\` ON \`payload_locked_documents_rels\` (\`downloads_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_faqs_id_idx\` ON \`payload_locked_documents_rels\` (\`faqs_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_support_tickets_id_idx\` ON \`payload_locked_documents_rels\` (\`support_tickets_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_support_ticket_messages_id_idx\` ON \`payload_locked_documents_rels\` (\`support_ticket_messages_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_licenses_id_idx\` ON \`payload_locked_documents_rels\` (\`licenses_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_forms_id_idx\` ON \`payload_locked_documents_rels\` (\`forms_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_form_submissions_id_idx\` ON \`payload_locked_documents_rels\` (\`form_submissions_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_search_id_idx\` ON \`payload_locked_documents_rels\` (\`search_id\`);`)
  await db.run(sql`CREATE TABLE \`__new_payload_preferences_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`customers_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`customers_id\`) REFERENCES \`customers\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_preferences_rels\`("id", "order", "parent_id", "path", "users_id", "customers_id") SELECT "id", "order", "parent_id", "path", "users_id", "customers_id" FROM \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_preferences_rels\` RENAME TO \`payload_preferences_rels\`;`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_customers_id_idx\` ON \`payload_preferences_rels\` (\`customers_id\`);`)
  await db.run(sql`DROP INDEX \`faqs_slug_idx\`;`)
  await db.run(sql`ALTER TABLE \`faqs_locales\` DROP COLUMN \`slug\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`enable_a_p_i_key\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`api_key\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`api_key_index\`;`)
}
