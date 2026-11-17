import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/*
 * G1 (plan-visual-globals) `globals_chrome_drafts`: header + footer get drafts/autosave.
 * - Up is additive: version tables (`_header_v*`, `_footer_v*`), `header._status` / `footer._status` + indexes,
 *   and a backfill of the existing main rows to 'published' (the new column defaults to 'draft'; G0: no initial
 *   version row is needed, the first autosave/publish creates it).
 * - Single exception (manager decision, G0 revision 3): Payload relaxes `footer_columns_locales.title` NOT NULL
 *   (localized required fields become nullable with drafts), which SQLite can only do by rebuilding the table.
 *   The rebuild runs ONLY while that table is empty; otherwise up() throws BEFORE any statement, so nothing
 *   changes (the migration transaction has nothing to roll back). No data is copied, dropped or deleted.
 * - Down drops only the version tables, the `_status` columns and their indexes, and refuses while an unpublished
 *   draft exists (that content lives only in the version tables). `title` stays nullable (not reverted: a NOT NULL
 *   rebuild could fail on/lose rows written after up()).
 */
export const FOOTER_REBUILD_REFUSED =
  'globals_chrome_drafts: footer_columns_locales is not empty; the NOT NULL -> nullable rebuild of this table is only allowed while it is empty. Nothing was changed. Back up the database and clear the footer columns (re-import them after migrating) or ask the maintainer.'
export const DOWN_REFUSED =
  'globals_chrome_drafts down refused: header/footer have an unpublished draft (it exists only in the version tables). Publish or discard it first, or restore from backup.'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  const [rows] = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM \`footer_columns_locales\`;`)
  if (Number(rows?.n ?? 0) > 0) throw new Error(FOOTER_REBUILD_REFUSED)
  await db.run(sql`CREATE TABLE \`_header_v_version_nav_items_children\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_route\` text,
  	\`link_route_param\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_header_v_version_nav_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_header_v_version_nav_items_children_order_idx\` ON \`_header_v_version_nav_items_children\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_version_nav_items_children_parent_id_idx\` ON \`_header_v_version_nav_items_children\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_header_v_version_nav_items_children_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_header_v_version_nav_items_children\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_header_v_version_nav_items_children_locales_locale_parent_i\` ON \`_header_v_version_nav_items_children_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_version_nav_items_children_locales_parent_id_idx\` ON \`_header_v_version_nav_items_children_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_header_v_version_nav_items_columns_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_route\` text,
  	\`link_route_param\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_header_v_version_nav_items_columns\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_header_v_version_nav_items_columns_links_order_idx\` ON \`_header_v_version_nav_items_columns_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_version_nav_items_columns_links_parent_id_idx\` ON \`_header_v_version_nav_items_columns_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_header_v_version_nav_items_columns_links_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_header_v_version_nav_items_columns_links\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_header_v_version_nav_items_columns_links_locales_locale_par\` ON \`_header_v_version_nav_items_columns_links_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_version_nav_items_columns_links_locales_parent_idx\` ON \`_header_v_version_nav_items_columns_links_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_header_v_version_nav_items_columns\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_header_v_version_nav_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_header_v_version_nav_items_columns_order_idx\` ON \`_header_v_version_nav_items_columns\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_version_nav_items_columns_parent_id_idx\` ON \`_header_v_version_nav_items_columns\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_header_v_version_nav_items_columns_locales\` (
  	\`title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_header_v_version_nav_items_columns\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_header_v_version_nav_items_columns_locales_locale_parent_id\` ON \`_header_v_version_nav_items_columns_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_version_nav_items_columns_locales_parent_id_idx\` ON \`_header_v_version_nav_items_columns_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_header_v_version_nav_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_route\` text,
  	\`link_route_param\` text,
  	\`mega_menu\` text,
  	\`featured_image_id\` integer,
  	\`featured_link_type\` text DEFAULT 'internal',
  	\`featured_link_new_tab\` integer,
  	\`featured_link_route\` text,
  	\`featured_link_route_param\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`featured_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_header_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_header_v_version_nav_items_order_idx\` ON \`_header_v_version_nav_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_version_nav_items_parent_id_idx\` ON \`_header_v_version_nav_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_version_nav_items_featured_featured_image_idx\` ON \`_header_v_version_nav_items\` (\`featured_image_id\`);`)
  await db.run(sql`CREATE TABLE \`_header_v_version_nav_items_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`featured_title\` text,
  	\`featured_description\` text,
  	\`featured_link_url\` text,
  	\`featured_link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_header_v_version_nav_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_header_v_version_nav_items_locales_locale_parent_id_unique\` ON \`_header_v_version_nav_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_version_nav_items_locales_parent_id_idx\` ON \`_header_v_version_nav_items_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_header_v_version_utility_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_route\` text,
  	\`link_route_param\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_header_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_header_v_version_utility_links_order_idx\` ON \`_header_v_version_utility_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_version_utility_links_parent_id_idx\` ON \`_header_v_version_utility_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_header_v_version_utility_links_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_header_v_version_utility_links\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_header_v_version_utility_links_locales_locale_parent_id_uni\` ON \`_header_v_version_utility_links_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_version_utility_links_locales_parent_id_idx\` ON \`_header_v_version_utility_links_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_header_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`version_cta_link_type\` text DEFAULT 'internal',
  	\`version_cta_link_new_tab\` integer,
  	\`version_cta_link_route\` text,
  	\`version_cta_link_route_param\` text,
  	\`version_cta_secondary_type\` text DEFAULT 'internal',
  	\`version_cta_secondary_new_tab\` integer,
  	\`version_cta_secondary_route\` text,
  	\`version_cta_secondary_route_param\` text,
  	\`version_announcement_enabled\` integer DEFAULT false,
  	\`version_announcement_dismissible\` integer DEFAULT true,
  	\`version_announcement_link_type\` text DEFAULT 'internal',
  	\`version_announcement_link_new_tab\` integer,
  	\`version_announcement_link_route\` text,
  	\`version_announcement_link_route_param\` text,
  	\`version_utility_show_search\` integer DEFAULT true,
  	\`version_utility_show_language\` integer DEFAULT true,
  	\`version_utility_show_account\` integer DEFAULT true,
  	\`version__status\` text DEFAULT 'draft',
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`snapshot\` integer,
  	\`published_locale\` text,
  	\`latest\` integer,
  	\`autosave\` integer
  );
  `)
  await db.run(sql`CREATE INDEX \`_header_v_version_version__status_idx\` ON \`_header_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_created_at_idx\` ON \`_header_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_updated_at_idx\` ON \`_header_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_snapshot_idx\` ON \`_header_v\` (\`snapshot\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_published_locale_idx\` ON \`_header_v\` (\`published_locale\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_latest_idx\` ON \`_header_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_autosave_idx\` ON \`_header_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE \`_header_v_locales\` (
  	\`version_cta_link_url\` text,
  	\`version_cta_link_label\` text,
  	\`version_cta_secondary_url\` text,
  	\`version_cta_secondary_label\` text,
  	\`version_announcement_text\` text,
  	\`version_announcement_link_url\` text,
  	\`version_announcement_link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_header_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_header_v_locales_locale_parent_id_unique\` ON \`_header_v_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_locales_parent_id_idx\` ON \`_header_v_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_header_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`pages_id\` integer,
  	\`products_id\` integer,
  	\`product_families_id\` integer,
  	\`solutions_id\` integer,
  	\`industries_id\` integer,
  	\`case_studies_id\` integer,
  	\`posts_id\` integer,
  	\`careers_id\` integer,
  	\`docs_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_header_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`product_families_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`solutions_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`industries_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`case_studies_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`careers_id\`) REFERENCES \`careers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`docs_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_header_v_rels_order_idx\` ON \`_header_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_rels_parent_idx\` ON \`_header_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_rels_path_idx\` ON \`_header_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_rels_pages_id_idx\` ON \`_header_v_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_rels_products_id_idx\` ON \`_header_v_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_rels_product_families_id_idx\` ON \`_header_v_rels\` (\`product_families_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_rels_solutions_id_idx\` ON \`_header_v_rels\` (\`solutions_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_rels_industries_id_idx\` ON \`_header_v_rels\` (\`industries_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_rels_case_studies_id_idx\` ON \`_header_v_rels\` (\`case_studies_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_rels_posts_id_idx\` ON \`_header_v_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_rels_careers_id_idx\` ON \`_header_v_rels\` (\`careers_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_rels_docs_id_idx\` ON \`_header_v_rels\` (\`docs_id\`);`)
  await db.run(sql`CREATE TABLE \`_footer_v_version_columns_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_route\` text,
  	\`link_route_param\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_footer_v_version_columns\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_footer_v_version_columns_links_order_idx\` ON \`_footer_v_version_columns_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_version_columns_links_parent_id_idx\` ON \`_footer_v_version_columns_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_footer_v_version_columns_links_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_footer_v_version_columns_links\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_footer_v_version_columns_links_locales_locale_parent_id_uni\` ON \`_footer_v_version_columns_links_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_version_columns_links_locales_parent_id_idx\` ON \`_footer_v_version_columns_links_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_footer_v_version_columns\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_footer_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_footer_v_version_columns_order_idx\` ON \`_footer_v_version_columns\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_version_columns_parent_id_idx\` ON \`_footer_v_version_columns\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_footer_v_version_columns_locales\` (
  	\`title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_footer_v_version_columns\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_footer_v_version_columns_locales_locale_parent_id_unique\` ON \`_footer_v_version_columns_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_version_columns_locales_parent_id_idx\` ON \`_footer_v_version_columns_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_footer_v_version_legal_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_route\` text,
  	\`link_route_param\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_footer_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_footer_v_version_legal_links_order_idx\` ON \`_footer_v_version_legal_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_version_legal_links_parent_id_idx\` ON \`_footer_v_version_legal_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_footer_v_version_legal_links_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_footer_v_version_legal_links\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_footer_v_version_legal_links_locales_locale_parent_id_uniqu\` ON \`_footer_v_version_legal_links_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_version_legal_links_locales_parent_id_idx\` ON \`_footer_v_version_legal_links_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_footer_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`version_show_newsletter\` integer DEFAULT false,
  	\`version_newsletter_form_id\` integer,
  	\`version_show_contact\` integer DEFAULT true,
  	\`version_show_social\` integer DEFAULT true,
  	\`version__status\` text DEFAULT 'draft',
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`snapshot\` integer,
  	\`published_locale\` text,
  	\`latest\` integer,
  	\`autosave\` integer,
  	FOREIGN KEY (\`version_newsletter_form_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_footer_v_version_version_newsletter_form_idx\` ON \`_footer_v\` (\`version_newsletter_form_id\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_version_version__status_idx\` ON \`_footer_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_created_at_idx\` ON \`_footer_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_updated_at_idx\` ON \`_footer_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_snapshot_idx\` ON \`_footer_v\` (\`snapshot\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_published_locale_idx\` ON \`_footer_v\` (\`published_locale\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_latest_idx\` ON \`_footer_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_autosave_idx\` ON \`_footer_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE \`_footer_v_locales\` (
  	\`version_copyright\` text,
  	\`version_brand_blurb\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_footer_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_footer_v_locales_locale_parent_id_unique\` ON \`_footer_v_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_locales_parent_id_idx\` ON \`_footer_v_locales\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_footer_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`pages_id\` integer,
  	\`products_id\` integer,
  	\`product_families_id\` integer,
  	\`solutions_id\` integer,
  	\`industries_id\` integer,
  	\`case_studies_id\` integer,
  	\`posts_id\` integer,
  	\`careers_id\` integer,
  	\`docs_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_footer_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`product_families_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`solutions_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`industries_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`case_studies_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`careers_id\`) REFERENCES \`careers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`docs_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_footer_v_rels_order_idx\` ON \`_footer_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_rels_parent_idx\` ON \`_footer_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_rels_path_idx\` ON \`_footer_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_rels_pages_id_idx\` ON \`_footer_v_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_rels_products_id_idx\` ON \`_footer_v_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_rels_product_families_id_idx\` ON \`_footer_v_rels\` (\`product_families_id\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_rels_solutions_id_idx\` ON \`_footer_v_rels\` (\`solutions_id\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_rels_industries_id_idx\` ON \`_footer_v_rels\` (\`industries_id\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_rels_case_studies_id_idx\` ON \`_footer_v_rels\` (\`case_studies_id\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_rels_posts_id_idx\` ON \`_footer_v_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_rels_careers_id_idx\` ON \`_footer_v_rels\` (\`careers_id\`);`)
  await db.run(sql`CREATE INDEX \`_footer_v_rels_docs_id_idx\` ON \`_footer_v_rels\` (\`docs_id\`);`)
  // Empty table (checked above): rebuild without copying rows; only `title` loses NOT NULL.
  await db.run(sql`CREATE TABLE \`__new_footer_columns_locales\` (
  	\`title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer_columns\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`DROP TABLE \`footer_columns_locales\`;`)
  await db.run(sql`ALTER TABLE \`__new_footer_columns_locales\` RENAME TO \`footer_columns_locales\`;`)
  await db.run(sql`CREATE UNIQUE INDEX \`footer_columns_locales_locale_parent_id_unique\` ON \`footer_columns_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`footer_columns_locales_parent_id_idx\` ON \`footer_columns_locales\` (\`_parent_id\`);`)
  await db.run(sql`ALTER TABLE \`header\` ADD \`_status\` text DEFAULT 'draft';`)
  await db.run(sql`CREATE INDEX \`header__status_idx\` ON \`header\` (\`_status\`);`)
  await db.run(sql`ALTER TABLE \`footer\` ADD \`_status\` text DEFAULT 'draft';`)
  await db.run(sql`CREATE INDEX \`footer__status_idx\` ON \`footer\` (\`_status\`);`)
  // Backfill: the existing (public) main rows are published content.
  await db.run(sql`UPDATE \`header\` SET \`_status\` = 'published';`)
  await db.run(sql`UPDATE \`footer\` SET \`_status\` = 'published';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  const [pending] = await db.all<{ n: number }>(sql`SELECT
    (SELECT COUNT(*) FROM \`_header_v\` WHERE \`latest\` = 1 AND \`version__status\` = 'draft')
    + (SELECT COUNT(*) FROM \`_footer_v\` WHERE \`latest\` = 1 AND \`version__status\` = 'draft') AS n;`)
  if (Number(pending?.n ?? 0) > 0) throw new Error(DOWN_REFUSED)
  // Children before parents. Published history is a copy of earlier main-row states (the current one is in the
  // main row); it is dropped with the tables — take a backup first if the history must be kept.
  for (const table of [
    '_header_v_version_nav_items_children_locales', '_header_v_version_nav_items_children',
    '_header_v_version_nav_items_columns_links_locales', '_header_v_version_nav_items_columns_links',
    '_header_v_version_nav_items_columns_locales', '_header_v_version_nav_items_columns',
    '_header_v_version_nav_items_locales', '_header_v_version_nav_items',
    '_header_v_version_utility_links_locales', '_header_v_version_utility_links',
    '_header_v_locales', '_header_v_rels', '_header_v',
    '_footer_v_version_columns_links_locales', '_footer_v_version_columns_links',
    '_footer_v_version_columns_locales', '_footer_v_version_columns',
    '_footer_v_version_legal_links_locales', '_footer_v_version_legal_links',
    '_footer_v_locales', '_footer_v_rels', '_footer_v',
  ]) await db.run(sql.raw(`DROP TABLE \`${table}\`;`))
  await db.run(sql`DROP INDEX \`header__status_idx\`;`)
  await db.run(sql`ALTER TABLE \`header\` DROP COLUMN \`_status\`;`)
  await db.run(sql`DROP INDEX \`footer__status_idx\`;`)
  await db.run(sql`ALTER TABLE \`footer\` DROP COLUMN \`_status\`;`)
  // footer_columns_locales.title stays nullable (see the header comment).
}
