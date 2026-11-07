import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // PRAGMA foreign_keys=OFF has no effect inside Payload's transaction.
  // Preserve children before rebuilding their parent (ON DELETE CASCADE).
  await db.run(sql`CREATE TEMP TABLE saved_site_settings_locales AS SELECT * FROM site_settings_locales`)
  await db.run(sql`CREATE TEMP TABLE saved_site_settings_social AS SELECT * FROM site_settings_social`)
  await db.run(sql`CREATE TABLE \`__new_site_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`logo_id\` integer,
  	\`logo_dark_id\` integer,
  	\`default_og_image_id\` integer,
  	\`company_legal_name\` text,
  	\`company_tax_office\` text,
  	\`company_tax_number\` text,
  	\`company_mersis_no\` text,
  	\`company_kep_address\` text,
  	\`contact_email\` text,
  	\`contact_sales_email\` text,
  	\`contact_support_email\` text,
  	\`contact_phone\` text,
  	\`contact_map_url\` text,
  	\`legal_kvkk_id\` integer,
  	\`legal_privacy_id\` integer,
  	\`legal_cookies_id\` integer,
  	\`legal_terms_id\` integer,
  	\`legal_eula_id\` integer,
  	\`commerce_quote_form_id\` integer,
  	\`commerce_demo_form_id\` integer,
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`logo_dark_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`default_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`legal_kvkk_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`legal_privacy_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`legal_cookies_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`legal_terms_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`legal_eula_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`commerce_quote_form_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`commerce_demo_form_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_site_settings\`("id", "logo_id", "logo_dark_id", "default_og_image_id", "company_legal_name", "company_tax_office", "company_tax_number", "company_mersis_no", "company_kep_address", "contact_email", "contact_sales_email", "contact_support_email", "contact_phone", "contact_map_url", "legal_kvkk_id", "legal_privacy_id", "legal_cookies_id", "legal_terms_id", "legal_eula_id", "commerce_quote_form_id", "commerce_demo_form_id", "updated_at", "created_at") SELECT "id", "logo_id", "logo_dark_id", "default_og_image_id", "company_legal_name", "company_tax_office", "company_tax_number", "company_mersis_no", "company_kep_address", "contact_email", "contact_sales_email", "contact_support_email", "contact_phone", "contact_map_url", "legal_kvkk_id", "legal_privacy_id", "legal_cookies_id", "legal_terms_id", "legal_eula_id", "commerce_quote_form_id", "commerce_demo_form_id", "updated_at", "created_at" FROM \`site_settings\`;`)
  await db.run(sql`DROP TABLE \`site_settings\`;`)
  await db.run(sql`ALTER TABLE \`__new_site_settings\` RENAME TO \`site_settings\`;`)
  await db.run(sql`DELETE FROM site_settings_locales`)
  await db.run(sql`DELETE FROM site_settings_social`)
  await db.run(sql`INSERT INTO site_settings_locales SELECT * FROM saved_site_settings_locales`)
  await db.run(sql`INSERT INTO site_settings_social SELECT * FROM saved_site_settings_social`)
  await db.run(sql`DROP TABLE saved_site_settings_locales`)
  await db.run(sql`DROP TABLE saved_site_settings_social`)
  await db.run(sql`CREATE INDEX \`site_settings_logo_idx\` ON \`site_settings\` (\`logo_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_logo_dark_idx\` ON \`site_settings\` (\`logo_dark_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_default_og_image_idx\` ON \`site_settings\` (\`default_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_kvkk_idx\` ON \`site_settings\` (\`legal_kvkk_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_privacy_idx\` ON \`site_settings\` (\`legal_privacy_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_cookies_idx\` ON \`site_settings\` (\`legal_cookies_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_terms_idx\` ON \`site_settings\` (\`legal_terms_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_eula_idx\` ON \`site_settings\` (\`legal_eula_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_commerce_commerce_quote_form_idx\` ON \`site_settings\` (\`commerce_quote_form_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_commerce_commerce_demo_form_idx\` ON \`site_settings\` (\`commerce_demo_form_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`legal_distance_sales_id\` integer REFERENCES pages(id);`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`legal_pre_information_id\` integer REFERENCES pages(id);`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`legal_refund_id\` integer REFERENCES pages(id);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_distance_sales_idx\` ON \`site_settings\` (\`legal_distance_sales_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_pre_information_idx\` ON \`site_settings\` (\`legal_pre_information_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_refund_idx\` ON \`site_settings\` (\`legal_refund_id\`);`)
}
