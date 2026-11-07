import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`header_nav_items_columns_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_route\` text,
  	\`link_route_param\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`header_nav_items_columns\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`header_nav_items_columns_links_order_idx\` ON \`header_nav_items_columns_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`header_nav_items_columns_links_parent_id_idx\` ON \`header_nav_items_columns_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`header_nav_items_columns_links_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`header_nav_items_columns_links\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`header_nav_items_columns_links_locales_locale_parent_id_uniq\` ON \`header_nav_items_columns_links_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`header_nav_items_columns\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`header_nav_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`header_nav_items_columns_order_idx\` ON \`header_nav_items_columns\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`header_nav_items_columns_parent_id_idx\` ON \`header_nav_items_columns\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`header_nav_items_columns_locales\` (
  	\`title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`header_nav_items_columns\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`header_nav_items_columns_locales_locale_parent_id_unique\` ON \`header_nav_items_columns_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`header_utility_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_route\` text,
  	\`link_route_param\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`header\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`header_utility_links_order_idx\` ON \`header_utility_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`header_utility_links_parent_id_idx\` ON \`header_utility_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`header_utility_links_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`header_utility_links\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`header_utility_links_locales_locale_parent_id_unique\` ON \`header_utility_links_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`ALTER TABLE \`products_blocks_hero_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`products_blocks_hero_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`products_blocks_media_text_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`products_blocks_media_text_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`products_blocks_cta_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`products_blocks_cta_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_hero_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_hero_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_media_text_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_media_text_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_cta_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_cta_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_hero_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_hero_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_media_text_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_media_text_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_cta_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_cta_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_hero_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_hero_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_media_text_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_media_text_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_cta_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_cta_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_hero_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_hero_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_media_text_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_media_text_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_cta_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_cta_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_hero_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_hero_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_media_text_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_media_text_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_cta_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_cta_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_hero_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_hero_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_media_text_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_media_text_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_cta_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_cta_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_hero_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_hero_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_media_text_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_media_text_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_cta_actions\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_cta_actions\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`header_nav_items_children\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`header_nav_items_children\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`header_nav_items\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`header_nav_items\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`header_nav_items\` ADD \`featured_image_id\` integer REFERENCES media(id);`)
  await db.run(sql`ALTER TABLE \`header_nav_items\` ADD \`featured_link_type\` text DEFAULT 'internal';`)
  await db.run(sql`ALTER TABLE \`header_nav_items\` ADD \`featured_link_new_tab\` integer;`)
  await db.run(sql`ALTER TABLE \`header_nav_items\` ADD \`featured_link_route\` text;`)
  await db.run(sql`ALTER TABLE \`header_nav_items\` ADD \`featured_link_route_param\` text;`)
  await db.run(sql`CREATE INDEX \`header_nav_items_featured_featured_image_idx\` ON \`header_nav_items\` (\`featured_image_id\`);`)
  await db.run(sql`ALTER TABLE \`header_nav_items_locales\` ADD \`featured_title\` text;`)
  await db.run(sql`ALTER TABLE \`header_nav_items_locales\` ADD \`featured_description\` text;`)
  await db.run(sql`ALTER TABLE \`header_nav_items_locales\` ADD \`featured_link_url\` text;`)
  await db.run(sql`ALTER TABLE \`header_nav_items_locales\` ADD \`featured_link_label\` text;`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`cta_link_route\` text;`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`cta_link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`cta_secondary_type\` text DEFAULT 'internal';`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`cta_secondary_new_tab\` integer;`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`cta_secondary_route\` text;`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`cta_secondary_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`announcement_enabled\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`announcement_dismissible\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`announcement_link_type\` text DEFAULT 'internal';`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`announcement_link_new_tab\` integer;`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`announcement_link_route\` text;`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`announcement_link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`utility_show_search\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`utility_show_language\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`utility_show_account\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`header_locales\` ADD \`cta_secondary_url\` text;`)
  await db.run(sql`ALTER TABLE \`header_locales\` ADD \`cta_secondary_label\` text;`)
  await db.run(sql`ALTER TABLE \`header_locales\` ADD \`announcement_text\` text;`)
  await db.run(sql`ALTER TABLE \`header_locales\` ADD \`announcement_link_url\` text;`)
  await db.run(sql`ALTER TABLE \`header_locales\` ADD \`announcement_link_label\` text;`)
  await db.run(sql`ALTER TABLE \`footer_columns_links\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`footer_columns_links\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`footer_legal_links\` ADD \`link_route\` text;`)
  await db.run(sql`ALTER TABLE \`footer_legal_links\` ADD \`link_route_param\` text;`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`show_contact\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`show_social\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`footer_locales\` ADD \`brand_blurb\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`favicon_id\` integer REFERENCES media(id);`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`brand_accent\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`motion\` text DEFAULT 'subtle';`)
  await db.run(sql`CREATE INDEX \`site_settings_favicon_idx\` ON \`site_settings\` (\`favicon_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Hand-written: the generated down rebuilt header_nav_items/site_settings via __new_ tables.
  // Inside the migration transaction PRAGMA foreign_keys=OFF is ignored, so DROP TABLE would
  // cascade into existing locales/children/social rows. Drop only what up() added.
  await db.run(sql`DROP INDEX \`header_nav_items_featured_featured_image_idx\`;`)
  await db.run(sql`DROP INDEX \`site_settings_favicon_idx\`;`)
  await db.run(sql`DROP TABLE \`header_nav_items_columns_links_locales\`;`)
  await db.run(sql`DROP TABLE \`header_nav_items_columns_locales\`;`)
  await db.run(sql`DROP TABLE \`header_nav_items_columns_links\`;`)
  await db.run(sql`DROP TABLE \`header_utility_links_locales\`;`)
  await db.run(sql`DROP TABLE \`header_nav_items_columns\`;`)
  await db.run(sql`DROP TABLE \`header_utility_links\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_hero_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_hero_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_media_text_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_media_text_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_cta_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_cta_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_hero_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_hero_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_media_text_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_media_text_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_cta_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_cta_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_hero_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_hero_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_media_text_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_media_text_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_cta_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_cta_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_hero_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_hero_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_media_text_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_media_text_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_cta_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_cta_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_hero_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_hero_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_media_text_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_media_text_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_cta_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_cta_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_hero_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_hero_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_media_text_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_media_text_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_cta_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_cta_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_hero_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_hero_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_media_text_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_media_text_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_cta_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_cta_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_hero_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_hero_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_media_text_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_media_text_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_cta_actions\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_cta_actions\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`header_nav_items_children\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`header_nav_items_children\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`header_nav_items\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`header_nav_items\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`header_nav_items\` DROP COLUMN \`featured_image_id\`;`)
  await db.run(sql`ALTER TABLE \`header_nav_items\` DROP COLUMN \`featured_link_type\`;`)
  await db.run(sql`ALTER TABLE \`header_nav_items\` DROP COLUMN \`featured_link_new_tab\`;`)
  await db.run(sql`ALTER TABLE \`header_nav_items\` DROP COLUMN \`featured_link_route\`;`)
  await db.run(sql`ALTER TABLE \`header_nav_items\` DROP COLUMN \`featured_link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`header_nav_items_locales\` DROP COLUMN \`featured_title\`;`)
  await db.run(sql`ALTER TABLE \`header_nav_items_locales\` DROP COLUMN \`featured_description\`;`)
  await db.run(sql`ALTER TABLE \`header_nav_items_locales\` DROP COLUMN \`featured_link_url\`;`)
  await db.run(sql`ALTER TABLE \`header_nav_items_locales\` DROP COLUMN \`featured_link_label\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`cta_link_route\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`cta_link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`cta_secondary_type\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`cta_secondary_new_tab\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`cta_secondary_route\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`cta_secondary_route_param\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`announcement_enabled\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`announcement_dismissible\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`announcement_link_type\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`announcement_link_new_tab\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`announcement_link_route\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`announcement_link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`utility_show_search\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`utility_show_language\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`utility_show_account\`;`)
  await db.run(sql`ALTER TABLE \`header_locales\` DROP COLUMN \`cta_secondary_url\`;`)
  await db.run(sql`ALTER TABLE \`header_locales\` DROP COLUMN \`cta_secondary_label\`;`)
  await db.run(sql`ALTER TABLE \`header_locales\` DROP COLUMN \`announcement_text\`;`)
  await db.run(sql`ALTER TABLE \`header_locales\` DROP COLUMN \`announcement_link_url\`;`)
  await db.run(sql`ALTER TABLE \`header_locales\` DROP COLUMN \`announcement_link_label\`;`)
  await db.run(sql`ALTER TABLE \`footer_columns_links\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`footer_columns_links\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`footer_legal_links\` DROP COLUMN \`link_route\`;`)
  await db.run(sql`ALTER TABLE \`footer_legal_links\` DROP COLUMN \`link_route_param\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`show_contact\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`show_social\`;`)
  await db.run(sql`ALTER TABLE \`footer_locales\` DROP COLUMN \`brand_blurb\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`favicon_id\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`brand_accent\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`motion\`;`)
}
