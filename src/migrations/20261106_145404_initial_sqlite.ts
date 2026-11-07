import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`users_roles\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_roles_order_idx\` ON \`users_roles\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`users_roles_parent_idx\` ON \`users_roles\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`customers_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`customers\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`customers_sessions_order_idx\` ON \`customers_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`customers_sessions_parent_id_idx\` ON \`customers_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`customers\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`company\` text,
  	\`phone\` text,
  	\`tax_number\` text,
  	\`tax_office\` text,
  	\`billing_address_line1\` text,
  	\`billing_address_line2\` text,
  	\`billing_address_district\` text,
  	\`billing_address_city\` text,
  	\`billing_address_postal_code\` text,
  	\`billing_address_country\` text DEFAULT 'TR',
  	\`preferred_locale\` text DEFAULT 'tr',
  	\`marketing_consent\` integer DEFAULT false,
  	\`notes\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`_verified\` integer,
  	\`_verificationtoken\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`customers_updated_at_idx\` ON \`customers\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`customers_created_at_idx\` ON \`customers\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`customers_email_idx\` ON \`customers\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`product_families\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`icon\` text,
  	\`image_id\` integer,
  	\`sort_order\` numeric DEFAULT 0,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_image_idx\` ON \`product_families\` (\`image_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_sort_order_idx\` ON \`product_families\` (\`sort_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_updated_at_idx\` ON \`product_families\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`product_families_created_at_idx\` ON \`product_families\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`product_families_locales\` (
  	\`title\` text NOT NULL,
  	\`tagline\` text,
  	\`description\` text,
  	\`meta_title\` text,
  	\`meta_description\` text,
  	\`meta_image_id\` integer,
  	\`slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_meta_meta_image_idx\` ON \`product_families_locales\` (\`meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_slug_idx\` ON \`product_families_locales\` (\`slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_locales_locale_parent_id_unique\` ON \`product_families_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_hero_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_hero_actions_order_idx\` ON \`products_blocks_hero_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_hero_actions_parent_id_idx\` ON \`products_blocks_hero_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_hero_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_hero_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_hero_actions_locales_locale_parent_id_unique\` ON \`products_blocks_hero_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_hero\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`variant\` text DEFAULT 'default',
  	\`media_id\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_hero_order_idx\` ON \`products_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_hero_parent_id_idx\` ON \`products_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_hero_path_idx\` ON \`products_blocks_hero\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_hero_media_idx\` ON \`products_blocks_hero\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_hero_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`subheading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_hero_locales_locale_parent_id_unique\` ON \`products_blocks_hero_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_feature_grid_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`icon\` text,
  	\`image_id\` integer,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_feature_grid_items_order_idx\` ON \`products_blocks_feature_grid_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_feature_grid_items_parent_id_idx\` ON \`products_blocks_feature_grid_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_feature_grid_items_image_idx\` ON \`products_blocks_feature_grid_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_feature_grid_items_locales\` (
  	\`title\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_feature_grid_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_feature_grid_items_locales_locale_parent_id_\` ON \`products_blocks_feature_grid_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_feature_grid\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`columns\` text DEFAULT '3',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_feature_grid_order_idx\` ON \`products_blocks_feature_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_feature_grid_parent_id_idx\` ON \`products_blocks_feature_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_feature_grid_path_idx\` ON \`products_blocks_feature_grid\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_feature_grid_locales\` (
  	\`heading\` text,
  	\`intro\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_feature_grid_locales_locale_parent_id_unique\` ON \`products_blocks_feature_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_media_text_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_media_text_actions_order_idx\` ON \`products_blocks_media_text_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_media_text_actions_parent_id_idx\` ON \`products_blocks_media_text_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_media_text_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_media_text_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_media_text_actions_locales_locale_parent_id_\` ON \`products_blocks_media_text_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_media_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	\`media_position\` text DEFAULT 'left',
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_media_text_order_idx\` ON \`products_blocks_media_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_media_text_parent_id_idx\` ON \`products_blocks_media_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_media_text_path_idx\` ON \`products_blocks_media_text\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_media_text_media_idx\` ON \`products_blocks_media_text\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_media_text_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_media_text_locales_locale_parent_id_unique\` ON \`products_blocks_media_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_spec_table_groups_rows\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_spec_table_groups_rows_order_idx\` ON \`products_blocks_spec_table_groups_rows\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_spec_table_groups_rows_parent_id_idx\` ON \`products_blocks_spec_table_groups_rows\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_spec_table_groups_rows_locales\` (
  	\`label\` text,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_spec_table_groups_rows\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_spec_table_groups_rows_locales_locale_parent\` ON \`products_blocks_spec_table_groups_rows_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_spec_table_groups\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_spec_table_groups_order_idx\` ON \`products_blocks_spec_table_groups\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_spec_table_groups_parent_id_idx\` ON \`products_blocks_spec_table_groups\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_spec_table_groups_locales\` (
  	\`title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_spec_table_groups_locales_locale_parent_id_u\` ON \`products_blocks_spec_table_groups_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_spec_table\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_spec_table_order_idx\` ON \`products_blocks_spec_table\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_spec_table_parent_id_idx\` ON \`products_blocks_spec_table\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_spec_table_path_idx\` ON \`products_blocks_spec_table\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_spec_table_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_spec_table_locales_locale_parent_id_unique\` ON \`products_blocks_spec_table_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_stats_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`value\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_stats_items_order_idx\` ON \`products_blocks_stats_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_stats_items_parent_id_idx\` ON \`products_blocks_stats_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_stats_items_locales\` (
  	\`label\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_stats_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_stats_items_locales_locale_parent_id_unique\` ON \`products_blocks_stats_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_stats\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_stats_order_idx\` ON \`products_blocks_stats\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_stats_parent_id_idx\` ON \`products_blocks_stats\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_stats_path_idx\` ON \`products_blocks_stats\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_stats_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_stats_locales_locale_parent_id_unique\` ON \`products_blocks_stats_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_logo_wall_logos\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`logo_id\` integer,
  	\`name\` text,
  	\`url\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_logo_wall_logos_order_idx\` ON \`products_blocks_logo_wall_logos\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_logo_wall_logos_parent_id_idx\` ON \`products_blocks_logo_wall_logos\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_logo_wall_logos_logo_idx\` ON \`products_blocks_logo_wall_logos\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_logo_wall\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'manual',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_logo_wall_order_idx\` ON \`products_blocks_logo_wall\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_logo_wall_parent_id_idx\` ON \`products_blocks_logo_wall\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_logo_wall_path_idx\` ON \`products_blocks_logo_wall\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_logo_wall_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_logo_wall_locales_locale_parent_id_unique\` ON \`products_blocks_logo_wall_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_cta_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_cta_actions_order_idx\` ON \`products_blocks_cta_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_cta_actions_parent_id_idx\` ON \`products_blocks_cta_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_cta_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_cta_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_cta_actions_locales_locale_parent_id_unique\` ON \`products_blocks_cta_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_cta\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`style\` text DEFAULT 'banner',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_cta_order_idx\` ON \`products_blocks_cta\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_cta_parent_id_idx\` ON \`products_blocks_cta\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_cta_path_idx\` ON \`products_blocks_cta\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_cta_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_cta_locales_locale_parent_id_unique\` ON \`products_blocks_cta_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_faq_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_faq_items_order_idx\` ON \`products_blocks_faq_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_faq_items_parent_id_idx\` ON \`products_blocks_faq_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_faq_items_locales\` (
  	\`question\` text,
  	\`answer\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_faq_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_faq_items_locales_locale_parent_id_unique\` ON \`products_blocks_faq_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_faq\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'collection',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_faq_order_idx\` ON \`products_blocks_faq\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_faq_parent_id_idx\` ON \`products_blocks_faq\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_faq_path_idx\` ON \`products_blocks_faq\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_faq_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_faq_locales_locale_parent_id_unique\` ON \`products_blocks_faq_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_rich_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`width\` text DEFAULT 'normal',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_rich_text_order_idx\` ON \`products_blocks_rich_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_rich_text_parent_id_idx\` ON \`products_blocks_rich_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_rich_text_path_idx\` ON \`products_blocks_rich_text\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_rich_text_locales\` (
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_rich_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_rich_text_locales_locale_parent_id_unique\` ON \`products_blocks_rich_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_video_embed\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`poster_id\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`poster_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_video_embed_order_idx\` ON \`products_blocks_video_embed\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_video_embed_parent_id_idx\` ON \`products_blocks_video_embed\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_video_embed_path_idx\` ON \`products_blocks_video_embed\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_video_embed_poster_idx\` ON \`products_blocks_video_embed\` (\`poster_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_video_embed_locales\` (
  	\`heading\` text,
  	\`url\` text,
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_video_embed\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_video_embed_locales_locale_parent_id_unique\` ON \`products_blocks_video_embed_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_features\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`icon\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_features_order_idx\` ON \`products_features\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_features_parent_id_idx\` ON \`products_features\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_features_locales\` (
  	\`title\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_features\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_features_locales_locale_parent_id_unique\` ON \`products_features_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_specs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_specs_order_idx\` ON \`products_specs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_specs_parent_id_idx\` ON \`products_specs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_specs_locales\` (
  	\`group\` text,
  	\`label\` text,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_specs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_specs_locales_locale_parent_id_unique\` ON \`products_specs_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_system_requirements\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`os\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_system_requirements_order_idx\` ON \`products_system_requirements\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_system_requirements_parent_id_idx\` ON \`products_system_requirements\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_system_requirements_locales\` (
  	\`minimum\` text,
  	\`recommended\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_system_requirements\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_system_requirements_locales_locale_parent_id_unique\` ON \`products_system_requirements_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`hero_image_id\` integer,
  	\`brochure_id\` integer,
  	\`family_id\` integer,
  	\`featured\` integer DEFAULT false,
  	\`sort_order\` numeric DEFAULT 0,
  	\`published_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`brochure_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`family_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`products_hero_image_idx\` ON \`products\` (\`hero_image_id\`);`)
  await db.run(sql`CREATE INDEX \`products_brochure_idx\` ON \`products\` (\`brochure_id\`);`)
  await db.run(sql`CREATE INDEX \`products_family_idx\` ON \`products\` (\`family_id\`);`)
  await db.run(sql`CREATE INDEX \`products_sort_order_idx\` ON \`products\` (\`sort_order\`);`)
  await db.run(sql`CREATE INDEX \`products_published_at_idx\` ON \`products\` (\`published_at\`);`)
  await db.run(sql`CREATE INDEX \`products_updated_at_idx\` ON \`products\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`products_created_at_idx\` ON \`products\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`products__status_idx\` ON \`products\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`products_locales\` (
  	\`title\` text,
  	\`tagline\` text,
  	\`summary\` text,
  	\`meta_title\` text,
  	\`meta_description\` text,
  	\`meta_image_id\` integer,
  	\`slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_meta_meta_image_idx\` ON \`products_locales\` (\`meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`products_slug_idx\` ON \`products_locales\` (\`slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`products_locales_locale_parent_id_unique\` ON \`products_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_rels\` (
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
  	\`partners_id\` integer,
  	\`faqs_id\` integer,
  	\`media_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`product_families_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`solutions_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`industries_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`case_studies_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`careers_id\`) REFERENCES \`careers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`docs_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`partners_id\`) REFERENCES \`partners\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`faqs_id\`) REFERENCES \`faqs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_rels_order_idx\` ON \`products_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_parent_idx\` ON \`products_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_path_idx\` ON \`products_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_pages_id_idx\` ON \`products_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_products_id_idx\` ON \`products_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_product_families_id_idx\` ON \`products_rels\` (\`product_families_id\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_solutions_id_idx\` ON \`products_rels\` (\`solutions_id\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_industries_id_idx\` ON \`products_rels\` (\`industries_id\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_case_studies_id_idx\` ON \`products_rels\` (\`case_studies_id\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_posts_id_idx\` ON \`products_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_careers_id_idx\` ON \`products_rels\` (\`careers_id\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_docs_id_idx\` ON \`products_rels\` (\`docs_id\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_partners_id_idx\` ON \`products_rels\` (\`partners_id\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_faqs_id_idx\` ON \`products_rels\` (\`faqs_id\`);`)
  await db.run(sql`CREATE INDEX \`products_rels_media_id_idx\` ON \`products_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_hero_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_hero_actions_order_idx\` ON \`_products_v_blocks_hero_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_hero_actions_parent_id_idx\` ON \`_products_v_blocks_hero_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_hero_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_hero_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_hero_actions_locales_locale_parent_id_uni\` ON \`_products_v_blocks_hero_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_hero\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`variant\` text DEFAULT 'default',
  	\`media_id\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_hero_order_idx\` ON \`_products_v_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_hero_parent_id_idx\` ON \`_products_v_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_hero_path_idx\` ON \`_products_v_blocks_hero\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_hero_media_idx\` ON \`_products_v_blocks_hero\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_hero_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`subheading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_hero_locales_locale_parent_id_unique\` ON \`_products_v_blocks_hero_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_feature_grid_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`icon\` text,
  	\`image_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_feature_grid_items_order_idx\` ON \`_products_v_blocks_feature_grid_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_feature_grid_items_parent_id_idx\` ON \`_products_v_blocks_feature_grid_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_feature_grid_items_image_idx\` ON \`_products_v_blocks_feature_grid_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_feature_grid_items_locales\` (
  	\`title\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_feature_grid_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_feature_grid_items_locales_locale_parent_\` ON \`_products_v_blocks_feature_grid_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_feature_grid\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`columns\` text DEFAULT '3',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_feature_grid_order_idx\` ON \`_products_v_blocks_feature_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_feature_grid_parent_id_idx\` ON \`_products_v_blocks_feature_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_feature_grid_path_idx\` ON \`_products_v_blocks_feature_grid\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_feature_grid_locales\` (
  	\`heading\` text,
  	\`intro\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_feature_grid_locales_locale_parent_id_uni\` ON \`_products_v_blocks_feature_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_media_text_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_media_text_actions_order_idx\` ON \`_products_v_blocks_media_text_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_media_text_actions_parent_id_idx\` ON \`_products_v_blocks_media_text_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_media_text_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_media_text_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_media_text_actions_locales_locale_parent_\` ON \`_products_v_blocks_media_text_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_media_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	\`media_position\` text DEFAULT 'left',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_media_text_order_idx\` ON \`_products_v_blocks_media_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_media_text_parent_id_idx\` ON \`_products_v_blocks_media_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_media_text_path_idx\` ON \`_products_v_blocks_media_text\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_media_text_media_idx\` ON \`_products_v_blocks_media_text\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_media_text_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_media_text_locales_locale_parent_id_uniqu\` ON \`_products_v_blocks_media_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_spec_table_groups_rows\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_spec_table_groups_rows_order_idx\` ON \`_products_v_blocks_spec_table_groups_rows\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_spec_table_groups_rows_parent_id_idx\` ON \`_products_v_blocks_spec_table_groups_rows\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_spec_table_groups_rows_locales\` (
  	\`label\` text,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_spec_table_groups_rows\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_spec_table_groups_rows_locales_locale_par\` ON \`_products_v_blocks_spec_table_groups_rows_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_spec_table_groups\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_spec_table_groups_order_idx\` ON \`_products_v_blocks_spec_table_groups\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_spec_table_groups_parent_id_idx\` ON \`_products_v_blocks_spec_table_groups\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_spec_table_groups_locales\` (
  	\`title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_spec_table_groups_locales_locale_parent_i\` ON \`_products_v_blocks_spec_table_groups_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_spec_table\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_spec_table_order_idx\` ON \`_products_v_blocks_spec_table\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_spec_table_parent_id_idx\` ON \`_products_v_blocks_spec_table\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_spec_table_path_idx\` ON \`_products_v_blocks_spec_table\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_spec_table_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_spec_table_locales_locale_parent_id_uniqu\` ON \`_products_v_blocks_spec_table_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_stats_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`value\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_stats_items_order_idx\` ON \`_products_v_blocks_stats_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_stats_items_parent_id_idx\` ON \`_products_v_blocks_stats_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_stats_items_locales\` (
  	\`label\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_stats_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_stats_items_locales_locale_parent_id_uniq\` ON \`_products_v_blocks_stats_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_stats\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_stats_order_idx\` ON \`_products_v_blocks_stats\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_stats_parent_id_idx\` ON \`_products_v_blocks_stats\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_stats_path_idx\` ON \`_products_v_blocks_stats\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_stats_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_stats_locales_locale_parent_id_unique\` ON \`_products_v_blocks_stats_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_logo_wall_logos\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`logo_id\` integer,
  	\`name\` text,
  	\`url\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_logo_wall_logos_order_idx\` ON \`_products_v_blocks_logo_wall_logos\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_logo_wall_logos_parent_id_idx\` ON \`_products_v_blocks_logo_wall_logos\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_logo_wall_logos_logo_idx\` ON \`_products_v_blocks_logo_wall_logos\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_logo_wall\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'manual',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_logo_wall_order_idx\` ON \`_products_v_blocks_logo_wall\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_logo_wall_parent_id_idx\` ON \`_products_v_blocks_logo_wall\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_logo_wall_path_idx\` ON \`_products_v_blocks_logo_wall\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_logo_wall_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_logo_wall_locales_locale_parent_id_unique\` ON \`_products_v_blocks_logo_wall_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_cta_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_cta_actions_order_idx\` ON \`_products_v_blocks_cta_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_cta_actions_parent_id_idx\` ON \`_products_v_blocks_cta_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_cta_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_cta_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_cta_actions_locales_locale_parent_id_uniq\` ON \`_products_v_blocks_cta_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_cta\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`style\` text DEFAULT 'banner',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_cta_order_idx\` ON \`_products_v_blocks_cta\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_cta_parent_id_idx\` ON \`_products_v_blocks_cta\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_cta_path_idx\` ON \`_products_v_blocks_cta\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_cta_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_cta_locales_locale_parent_id_unique\` ON \`_products_v_blocks_cta_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_faq_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_faq_items_order_idx\` ON \`_products_v_blocks_faq_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_faq_items_parent_id_idx\` ON \`_products_v_blocks_faq_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_faq_items_locales\` (
  	\`question\` text,
  	\`answer\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_faq_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_faq_items_locales_locale_parent_id_unique\` ON \`_products_v_blocks_faq_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_faq\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'collection',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_faq_order_idx\` ON \`_products_v_blocks_faq\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_faq_parent_id_idx\` ON \`_products_v_blocks_faq\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_faq_path_idx\` ON \`_products_v_blocks_faq\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_faq_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_faq_locales_locale_parent_id_unique\` ON \`_products_v_blocks_faq_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_rich_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`width\` text DEFAULT 'normal',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_rich_text_order_idx\` ON \`_products_v_blocks_rich_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_rich_text_parent_id_idx\` ON \`_products_v_blocks_rich_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_rich_text_path_idx\` ON \`_products_v_blocks_rich_text\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_rich_text_locales\` (
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_rich_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_rich_text_locales_locale_parent_id_unique\` ON \`_products_v_blocks_rich_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_video_embed\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`poster_id\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`poster_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_video_embed_order_idx\` ON \`_products_v_blocks_video_embed\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_video_embed_parent_id_idx\` ON \`_products_v_blocks_video_embed\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_video_embed_path_idx\` ON \`_products_v_blocks_video_embed\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_video_embed_poster_idx\` ON \`_products_v_blocks_video_embed\` (\`poster_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_video_embed_locales\` (
  	\`heading\` text,
  	\`url\` text,
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_video_embed\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_video_embed_locales_locale_parent_id_uniq\` ON \`_products_v_blocks_video_embed_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_version_features\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`icon\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_version_features_order_idx\` ON \`_products_v_version_features\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_features_parent_id_idx\` ON \`_products_v_version_features\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_version_features_locales\` (
  	\`title\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_version_features\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_version_features_locales_locale_parent_id_unique\` ON \`_products_v_version_features_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_version_specs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_version_specs_order_idx\` ON \`_products_v_version_specs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_specs_parent_id_idx\` ON \`_products_v_version_specs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_version_specs_locales\` (
  	\`group\` text,
  	\`label\` text,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_version_specs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_version_specs_locales_locale_parent_id_unique\` ON \`_products_v_version_specs_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_version_system_requirements\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`os\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_version_system_requirements_order_idx\` ON \`_products_v_version_system_requirements\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_system_requirements_parent_id_idx\` ON \`_products_v_version_system_requirements\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_version_system_requirements_locales\` (
  	\`minimum\` text,
  	\`recommended\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_version_system_requirements\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_version_system_requirements_locales_locale_paren\` ON \`_products_v_version_system_requirements_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_hero_image_id\` integer,
  	\`version_brochure_id\` integer,
  	\`version_family_id\` integer,
  	\`version_featured\` integer DEFAULT false,
  	\`version_sort_order\` numeric DEFAULT 0,
  	\`version_published_at\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`snapshot\` integer,
  	\`published_locale\` text,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_brochure_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_family_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_parent_idx\` ON \`_products_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version_hero_image_idx\` ON \`_products_v\` (\`version_hero_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version_brochure_idx\` ON \`_products_v\` (\`version_brochure_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version_family_idx\` ON \`_products_v\` (\`version_family_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version_sort_order_idx\` ON \`_products_v\` (\`version_sort_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version_published_at_idx\` ON \`_products_v\` (\`version_published_at\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version_updated_at_idx\` ON \`_products_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version_created_at_idx\` ON \`_products_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version__status_idx\` ON \`_products_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_created_at_idx\` ON \`_products_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_updated_at_idx\` ON \`_products_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_snapshot_idx\` ON \`_products_v\` (\`snapshot\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_published_locale_idx\` ON \`_products_v\` (\`published_locale\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_latest_idx\` ON \`_products_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_locales\` (
  	\`version_title\` text,
  	\`version_tagline\` text,
  	\`version_summary\` text,
  	\`version_meta_title\` text,
  	\`version_meta_description\` text,
  	\`version_meta_image_id\` integer,
  	\`version_slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`version_meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_version_meta_version_meta_image_idx\` ON \`_products_v_locales\` (\`version_meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_version_version_slug_idx\` ON \`_products_v_locales\` (\`version_slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_locales_locale_parent_id_unique\` ON \`_products_v_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_rels\` (
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
  	\`partners_id\` integer,
  	\`faqs_id\` integer,
  	\`media_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`product_families_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`solutions_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`industries_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`case_studies_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`careers_id\`) REFERENCES \`careers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`docs_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`partners_id\`) REFERENCES \`partners\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`faqs_id\`) REFERENCES \`faqs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_rels_order_idx\` ON \`_products_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_parent_idx\` ON \`_products_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_path_idx\` ON \`_products_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_pages_id_idx\` ON \`_products_v_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_products_id_idx\` ON \`_products_v_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_product_families_id_idx\` ON \`_products_v_rels\` (\`product_families_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_solutions_id_idx\` ON \`_products_v_rels\` (\`solutions_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_industries_id_idx\` ON \`_products_v_rels\` (\`industries_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_case_studies_id_idx\` ON \`_products_v_rels\` (\`case_studies_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_posts_id_idx\` ON \`_products_v_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_careers_id_idx\` ON \`_products_v_rels\` (\`careers_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_docs_id_idx\` ON \`_products_v_rels\` (\`docs_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_partners_id_idx\` ON \`_products_v_rels\` (\`partners_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_faqs_id_idx\` ON \`_products_v_rels\` (\`faqs_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_rels_media_id_idx\` ON \`_products_v_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`editions_highlights\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`editions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`editions_highlights_order_idx\` ON \`editions_highlights\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`editions_highlights_parent_id_idx\` ON \`editions_highlights\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`editions_highlights_locales\` (
  	\`text\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`editions_highlights\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`editions_highlights_locales_locale_parent_id_unique\` ON \`editions_highlights_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`editions\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`sku\` text NOT NULL,
  	\`product_id\` integer NOT NULL,
  	\`prices_try\` numeric,
  	\`prices_usd\` numeric,
  	\`prices_eur\` numeric,
  	\`vat_rate\` numeric DEFAULT 20,
  	\`purchasable\` integer DEFAULT false,
  	\`license_type\` text DEFAULT 'perpetual' NOT NULL,
  	\`duration_months\` numeric,
  	\`seats\` numeric DEFAULT 1 NOT NULL,
  	\`sort_order\` numeric DEFAULT 0,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`editions_sku_idx\` ON \`editions\` (\`sku\`);`)
  await db.run(sql`CREATE INDEX \`editions_product_idx\` ON \`editions\` (\`product_id\`);`)
  await db.run(sql`CREATE INDEX \`editions_sort_order_idx\` ON \`editions\` (\`sort_order\`);`)
  await db.run(sql`CREATE INDEX \`editions_updated_at_idx\` ON \`editions\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`editions_created_at_idx\` ON \`editions\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`editions_locales\` (
  	\`title\` text NOT NULL,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`editions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`editions_locales_locale_parent_id_unique\` ON \`editions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_hero_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_hero_actions_order_idx\` ON \`solutions_blocks_hero_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_hero_actions_parent_id_idx\` ON \`solutions_blocks_hero_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_hero_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_hero_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_hero_actions_locales_locale_parent_id_uniqu\` ON \`solutions_blocks_hero_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_hero\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`variant\` text DEFAULT 'default',
  	\`media_id\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_hero_order_idx\` ON \`solutions_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_hero_parent_id_idx\` ON \`solutions_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_hero_path_idx\` ON \`solutions_blocks_hero\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_hero_media_idx\` ON \`solutions_blocks_hero\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_hero_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`subheading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_hero_locales_locale_parent_id_unique\` ON \`solutions_blocks_hero_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_feature_grid_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`icon\` text,
  	\`image_id\` integer,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_feature_grid_items_order_idx\` ON \`solutions_blocks_feature_grid_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_feature_grid_items_parent_id_idx\` ON \`solutions_blocks_feature_grid_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_feature_grid_items_image_idx\` ON \`solutions_blocks_feature_grid_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_feature_grid_items_locales\` (
  	\`title\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_feature_grid_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_feature_grid_items_locales_locale_parent_id\` ON \`solutions_blocks_feature_grid_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_feature_grid\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`columns\` text DEFAULT '3',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_feature_grid_order_idx\` ON \`solutions_blocks_feature_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_feature_grid_parent_id_idx\` ON \`solutions_blocks_feature_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_feature_grid_path_idx\` ON \`solutions_blocks_feature_grid\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_feature_grid_locales\` (
  	\`heading\` text,
  	\`intro\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_feature_grid_locales_locale_parent_id_uniqu\` ON \`solutions_blocks_feature_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_media_text_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_media_text_actions_order_idx\` ON \`solutions_blocks_media_text_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_media_text_actions_parent_id_idx\` ON \`solutions_blocks_media_text_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_media_text_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_media_text_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_media_text_actions_locales_locale_parent_id\` ON \`solutions_blocks_media_text_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_media_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	\`media_position\` text DEFAULT 'left',
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_media_text_order_idx\` ON \`solutions_blocks_media_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_media_text_parent_id_idx\` ON \`solutions_blocks_media_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_media_text_path_idx\` ON \`solutions_blocks_media_text\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_media_text_media_idx\` ON \`solutions_blocks_media_text\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_media_text_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_media_text_locales_locale_parent_id_unique\` ON \`solutions_blocks_media_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_spec_table_groups_rows\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_spec_table_groups_rows_order_idx\` ON \`solutions_blocks_spec_table_groups_rows\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_spec_table_groups_rows_parent_id_idx\` ON \`solutions_blocks_spec_table_groups_rows\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_spec_table_groups_rows_locales\` (
  	\`label\` text,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_spec_table_groups_rows\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_spec_table_groups_rows_locales_locale_paren\` ON \`solutions_blocks_spec_table_groups_rows_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_spec_table_groups\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_spec_table_groups_order_idx\` ON \`solutions_blocks_spec_table_groups\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_spec_table_groups_parent_id_idx\` ON \`solutions_blocks_spec_table_groups\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_spec_table_groups_locales\` (
  	\`title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_spec_table_groups_locales_locale_parent_id_\` ON \`solutions_blocks_spec_table_groups_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_spec_table\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_spec_table_order_idx\` ON \`solutions_blocks_spec_table\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_spec_table_parent_id_idx\` ON \`solutions_blocks_spec_table\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_spec_table_path_idx\` ON \`solutions_blocks_spec_table\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_spec_table_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_spec_table_locales_locale_parent_id_unique\` ON \`solutions_blocks_spec_table_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_stats_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`value\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_stats_items_order_idx\` ON \`solutions_blocks_stats_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_stats_items_parent_id_idx\` ON \`solutions_blocks_stats_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_stats_items_locales\` (
  	\`label\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_stats_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_stats_items_locales_locale_parent_id_unique\` ON \`solutions_blocks_stats_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_stats\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_stats_order_idx\` ON \`solutions_blocks_stats\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_stats_parent_id_idx\` ON \`solutions_blocks_stats\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_stats_path_idx\` ON \`solutions_blocks_stats\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_stats_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_stats_locales_locale_parent_id_unique\` ON \`solutions_blocks_stats_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_logo_wall_logos\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`logo_id\` integer,
  	\`name\` text,
  	\`url\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_logo_wall_logos_order_idx\` ON \`solutions_blocks_logo_wall_logos\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_logo_wall_logos_parent_id_idx\` ON \`solutions_blocks_logo_wall_logos\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_logo_wall_logos_logo_idx\` ON \`solutions_blocks_logo_wall_logos\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_logo_wall\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'manual',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_logo_wall_order_idx\` ON \`solutions_blocks_logo_wall\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_logo_wall_parent_id_idx\` ON \`solutions_blocks_logo_wall\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_logo_wall_path_idx\` ON \`solutions_blocks_logo_wall\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_logo_wall_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_logo_wall_locales_locale_parent_id_unique\` ON \`solutions_blocks_logo_wall_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_cta_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_cta_actions_order_idx\` ON \`solutions_blocks_cta_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_cta_actions_parent_id_idx\` ON \`solutions_blocks_cta_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_cta_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_cta_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_cta_actions_locales_locale_parent_id_unique\` ON \`solutions_blocks_cta_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_cta\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`style\` text DEFAULT 'banner',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_cta_order_idx\` ON \`solutions_blocks_cta\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_cta_parent_id_idx\` ON \`solutions_blocks_cta\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_cta_path_idx\` ON \`solutions_blocks_cta\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_cta_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_cta_locales_locale_parent_id_unique\` ON \`solutions_blocks_cta_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_faq_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_faq_items_order_idx\` ON \`solutions_blocks_faq_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_faq_items_parent_id_idx\` ON \`solutions_blocks_faq_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_faq_items_locales\` (
  	\`question\` text,
  	\`answer\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_faq_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_faq_items_locales_locale_parent_id_unique\` ON \`solutions_blocks_faq_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_faq\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'collection',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_faq_order_idx\` ON \`solutions_blocks_faq\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_faq_parent_id_idx\` ON \`solutions_blocks_faq\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_faq_path_idx\` ON \`solutions_blocks_faq\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_faq_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_faq_locales_locale_parent_id_unique\` ON \`solutions_blocks_faq_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_rich_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`width\` text DEFAULT 'normal',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_rich_text_order_idx\` ON \`solutions_blocks_rich_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_rich_text_parent_id_idx\` ON \`solutions_blocks_rich_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_rich_text_path_idx\` ON \`solutions_blocks_rich_text\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_rich_text_locales\` (
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_rich_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_rich_text_locales_locale_parent_id_unique\` ON \`solutions_blocks_rich_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_video_embed\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`poster_id\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`poster_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_video_embed_order_idx\` ON \`solutions_blocks_video_embed\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_video_embed_parent_id_idx\` ON \`solutions_blocks_video_embed\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_video_embed_path_idx\` ON \`solutions_blocks_video_embed\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_video_embed_poster_idx\` ON \`solutions_blocks_video_embed\` (\`poster_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_video_embed_locales\` (
  	\`heading\` text,
  	\`url\` text,
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_video_embed\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_video_embed_locales_locale_parent_id_unique\` ON \`solutions_blocks_video_embed_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`hero_image_id\` integer,
  	\`sort_order\` numeric DEFAULT 0,
  	\`published_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_hero_image_idx\` ON \`solutions\` (\`hero_image_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_sort_order_idx\` ON \`solutions\` (\`sort_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_published_at_idx\` ON \`solutions\` (\`published_at\`);`)
  await db.run(sql`CREATE INDEX \`solutions_updated_at_idx\` ON \`solutions\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`solutions_created_at_idx\` ON \`solutions\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`solutions__status_idx\` ON \`solutions\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`solutions_locales\` (
  	\`title\` text,
  	\`summary\` text,
  	\`meta_title\` text,
  	\`meta_description\` text,
  	\`meta_image_id\` integer,
  	\`slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_meta_meta_image_idx\` ON \`solutions_locales\` (\`meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_slug_idx\` ON \`solutions_locales\` (\`slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_locales_locale_parent_id_unique\` ON \`solutions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_rels\` (
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
  	\`partners_id\` integer,
  	\`faqs_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`product_families_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`solutions_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`industries_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`case_studies_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`careers_id\`) REFERENCES \`careers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`docs_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`partners_id\`) REFERENCES \`partners\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`faqs_id\`) REFERENCES \`faqs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_rels_order_idx\` ON \`solutions_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_rels_parent_idx\` ON \`solutions_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_rels_path_idx\` ON \`solutions_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`solutions_rels_pages_id_idx\` ON \`solutions_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_rels_products_id_idx\` ON \`solutions_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_rels_product_families_id_idx\` ON \`solutions_rels\` (\`product_families_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_rels_solutions_id_idx\` ON \`solutions_rels\` (\`solutions_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_rels_industries_id_idx\` ON \`solutions_rels\` (\`industries_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_rels_case_studies_id_idx\` ON \`solutions_rels\` (\`case_studies_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_rels_posts_id_idx\` ON \`solutions_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_rels_careers_id_idx\` ON \`solutions_rels\` (\`careers_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_rels_docs_id_idx\` ON \`solutions_rels\` (\`docs_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_rels_partners_id_idx\` ON \`solutions_rels\` (\`partners_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_rels_faqs_id_idx\` ON \`solutions_rels\` (\`faqs_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_hero_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_hero_actions_order_idx\` ON \`_solutions_v_blocks_hero_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_hero_actions_parent_id_idx\` ON \`_solutions_v_blocks_hero_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_hero_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_hero_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_hero_actions_locales_locale_parent_id_un\` ON \`_solutions_v_blocks_hero_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_hero\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`variant\` text DEFAULT 'default',
  	\`media_id\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_hero_order_idx\` ON \`_solutions_v_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_hero_parent_id_idx\` ON \`_solutions_v_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_hero_path_idx\` ON \`_solutions_v_blocks_hero\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_hero_media_idx\` ON \`_solutions_v_blocks_hero\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_hero_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`subheading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_hero_locales_locale_parent_id_unique\` ON \`_solutions_v_blocks_hero_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_feature_grid_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`icon\` text,
  	\`image_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_feature_grid_items_order_idx\` ON \`_solutions_v_blocks_feature_grid_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_feature_grid_items_parent_id_idx\` ON \`_solutions_v_blocks_feature_grid_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_feature_grid_items_image_idx\` ON \`_solutions_v_blocks_feature_grid_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_feature_grid_items_locales\` (
  	\`title\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_feature_grid_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_feature_grid_items_locales_locale_parent\` ON \`_solutions_v_blocks_feature_grid_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_feature_grid\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`columns\` text DEFAULT '3',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_feature_grid_order_idx\` ON \`_solutions_v_blocks_feature_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_feature_grid_parent_id_idx\` ON \`_solutions_v_blocks_feature_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_feature_grid_path_idx\` ON \`_solutions_v_blocks_feature_grid\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_feature_grid_locales\` (
  	\`heading\` text,
  	\`intro\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_feature_grid_locales_locale_parent_id_un\` ON \`_solutions_v_blocks_feature_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_media_text_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_media_text_actions_order_idx\` ON \`_solutions_v_blocks_media_text_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_media_text_actions_parent_id_idx\` ON \`_solutions_v_blocks_media_text_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_media_text_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_media_text_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_media_text_actions_locales_locale_parent\` ON \`_solutions_v_blocks_media_text_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_media_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	\`media_position\` text DEFAULT 'left',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_media_text_order_idx\` ON \`_solutions_v_blocks_media_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_media_text_parent_id_idx\` ON \`_solutions_v_blocks_media_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_media_text_path_idx\` ON \`_solutions_v_blocks_media_text\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_media_text_media_idx\` ON \`_solutions_v_blocks_media_text\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_media_text_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_media_text_locales_locale_parent_id_uniq\` ON \`_solutions_v_blocks_media_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_spec_table_groups_rows\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_spec_table_groups_rows_order_idx\` ON \`_solutions_v_blocks_spec_table_groups_rows\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_spec_table_groups_rows_parent_id_idx\` ON \`_solutions_v_blocks_spec_table_groups_rows\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_spec_table_groups_rows_locales\` (
  	\`label\` text,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_spec_table_groups_rows\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_spec_table_groups_rows_locales_locale_pa\` ON \`_solutions_v_blocks_spec_table_groups_rows_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_spec_table_groups\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_spec_table_groups_order_idx\` ON \`_solutions_v_blocks_spec_table_groups\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_spec_table_groups_parent_id_idx\` ON \`_solutions_v_blocks_spec_table_groups\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_spec_table_groups_locales\` (
  	\`title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_spec_table_groups_locales_locale_parent_\` ON \`_solutions_v_blocks_spec_table_groups_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_spec_table\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_spec_table_order_idx\` ON \`_solutions_v_blocks_spec_table\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_spec_table_parent_id_idx\` ON \`_solutions_v_blocks_spec_table\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_spec_table_path_idx\` ON \`_solutions_v_blocks_spec_table\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_spec_table_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_spec_table_locales_locale_parent_id_uniq\` ON \`_solutions_v_blocks_spec_table_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_stats_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`value\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_stats_items_order_idx\` ON \`_solutions_v_blocks_stats_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_stats_items_parent_id_idx\` ON \`_solutions_v_blocks_stats_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_stats_items_locales\` (
  	\`label\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_stats_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_stats_items_locales_locale_parent_id_uni\` ON \`_solutions_v_blocks_stats_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_stats\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_stats_order_idx\` ON \`_solutions_v_blocks_stats\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_stats_parent_id_idx\` ON \`_solutions_v_blocks_stats\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_stats_path_idx\` ON \`_solutions_v_blocks_stats\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_stats_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_stats_locales_locale_parent_id_unique\` ON \`_solutions_v_blocks_stats_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_logo_wall_logos\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`logo_id\` integer,
  	\`name\` text,
  	\`url\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_logo_wall_logos_order_idx\` ON \`_solutions_v_blocks_logo_wall_logos\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_logo_wall_logos_parent_id_idx\` ON \`_solutions_v_blocks_logo_wall_logos\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_logo_wall_logos_logo_idx\` ON \`_solutions_v_blocks_logo_wall_logos\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_logo_wall\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'manual',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_logo_wall_order_idx\` ON \`_solutions_v_blocks_logo_wall\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_logo_wall_parent_id_idx\` ON \`_solutions_v_blocks_logo_wall\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_logo_wall_path_idx\` ON \`_solutions_v_blocks_logo_wall\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_logo_wall_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_logo_wall_locales_locale_parent_id_uniqu\` ON \`_solutions_v_blocks_logo_wall_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_cta_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_cta_actions_order_idx\` ON \`_solutions_v_blocks_cta_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_cta_actions_parent_id_idx\` ON \`_solutions_v_blocks_cta_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_cta_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_cta_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_cta_actions_locales_locale_parent_id_uni\` ON \`_solutions_v_blocks_cta_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_cta\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`style\` text DEFAULT 'banner',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_cta_order_idx\` ON \`_solutions_v_blocks_cta\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_cta_parent_id_idx\` ON \`_solutions_v_blocks_cta\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_cta_path_idx\` ON \`_solutions_v_blocks_cta\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_cta_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_cta_locales_locale_parent_id_unique\` ON \`_solutions_v_blocks_cta_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_faq_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_faq_items_order_idx\` ON \`_solutions_v_blocks_faq_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_faq_items_parent_id_idx\` ON \`_solutions_v_blocks_faq_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_faq_items_locales\` (
  	\`question\` text,
  	\`answer\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_faq_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_faq_items_locales_locale_parent_id_uniqu\` ON \`_solutions_v_blocks_faq_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_faq\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'collection',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_faq_order_idx\` ON \`_solutions_v_blocks_faq\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_faq_parent_id_idx\` ON \`_solutions_v_blocks_faq\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_faq_path_idx\` ON \`_solutions_v_blocks_faq\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_faq_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_faq_locales_locale_parent_id_unique\` ON \`_solutions_v_blocks_faq_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_rich_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`width\` text DEFAULT 'normal',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_rich_text_order_idx\` ON \`_solutions_v_blocks_rich_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_rich_text_parent_id_idx\` ON \`_solutions_v_blocks_rich_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_rich_text_path_idx\` ON \`_solutions_v_blocks_rich_text\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_rich_text_locales\` (
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_rich_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_rich_text_locales_locale_parent_id_uniqu\` ON \`_solutions_v_blocks_rich_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_video_embed\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`poster_id\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`poster_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_video_embed_order_idx\` ON \`_solutions_v_blocks_video_embed\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_video_embed_parent_id_idx\` ON \`_solutions_v_blocks_video_embed\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_video_embed_path_idx\` ON \`_solutions_v_blocks_video_embed\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_video_embed_poster_idx\` ON \`_solutions_v_blocks_video_embed\` (\`poster_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_video_embed_locales\` (
  	\`heading\` text,
  	\`url\` text,
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_video_embed\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_video_embed_locales_locale_parent_id_uni\` ON \`_solutions_v_blocks_video_embed_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_hero_image_id\` integer,
  	\`version_sort_order\` numeric DEFAULT 0,
  	\`version_published_at\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`snapshot\` integer,
  	\`published_locale\` text,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_parent_idx\` ON \`_solutions_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_version_version_hero_image_idx\` ON \`_solutions_v\` (\`version_hero_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_version_version_sort_order_idx\` ON \`_solutions_v\` (\`version_sort_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_version_version_published_at_idx\` ON \`_solutions_v\` (\`version_published_at\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_version_version_updated_at_idx\` ON \`_solutions_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_version_version_created_at_idx\` ON \`_solutions_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_version_version__status_idx\` ON \`_solutions_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_created_at_idx\` ON \`_solutions_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_updated_at_idx\` ON \`_solutions_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_snapshot_idx\` ON \`_solutions_v\` (\`snapshot\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_published_locale_idx\` ON \`_solutions_v\` (\`published_locale\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_latest_idx\` ON \`_solutions_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_locales\` (
  	\`version_title\` text,
  	\`version_summary\` text,
  	\`version_meta_title\` text,
  	\`version_meta_description\` text,
  	\`version_meta_image_id\` integer,
  	\`version_slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`version_meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_version_meta_version_meta_image_idx\` ON \`_solutions_v_locales\` (\`version_meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_version_version_slug_idx\` ON \`_solutions_v_locales\` (\`version_slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_locales_locale_parent_id_unique\` ON \`_solutions_v_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_rels\` (
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
  	\`partners_id\` integer,
  	\`faqs_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`product_families_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`solutions_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`industries_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`case_studies_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`careers_id\`) REFERENCES \`careers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`docs_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`partners_id\`) REFERENCES \`partners\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`faqs_id\`) REFERENCES \`faqs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_rels_order_idx\` ON \`_solutions_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_rels_parent_idx\` ON \`_solutions_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_rels_path_idx\` ON \`_solutions_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_rels_pages_id_idx\` ON \`_solutions_v_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_rels_products_id_idx\` ON \`_solutions_v_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_rels_product_families_id_idx\` ON \`_solutions_v_rels\` (\`product_families_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_rels_solutions_id_idx\` ON \`_solutions_v_rels\` (\`solutions_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_rels_industries_id_idx\` ON \`_solutions_v_rels\` (\`industries_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_rels_case_studies_id_idx\` ON \`_solutions_v_rels\` (\`case_studies_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_rels_posts_id_idx\` ON \`_solutions_v_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_rels_careers_id_idx\` ON \`_solutions_v_rels\` (\`careers_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_rels_docs_id_idx\` ON \`_solutions_v_rels\` (\`docs_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_rels_partners_id_idx\` ON \`_solutions_v_rels\` (\`partners_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_rels_faqs_id_idx\` ON \`_solutions_v_rels\` (\`faqs_id\`);`)
  await db.run(sql`CREATE TABLE \`industries\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`icon\` text,
  	\`image_id\` integer,
  	\`sort_order\` numeric DEFAULT 0,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`industries_image_idx\` ON \`industries\` (\`image_id\`);`)
  await db.run(sql`CREATE INDEX \`industries_sort_order_idx\` ON \`industries\` (\`sort_order\`);`)
  await db.run(sql`CREATE INDEX \`industries_updated_at_idx\` ON \`industries\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`industries_created_at_idx\` ON \`industries\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`industries_locales\` (
  	\`title\` text NOT NULL,
  	\`summary\` text,
  	\`description\` text,
  	\`meta_title\` text,
  	\`meta_description\` text,
  	\`meta_image_id\` integer,
  	\`slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`industries_meta_meta_image_idx\` ON \`industries_locales\` (\`meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`industries_slug_idx\` ON \`industries_locales\` (\`slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`industries_locales_locale_parent_id_unique\` ON \`industries_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_results\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`value\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_results_order_idx\` ON \`case_studies_results\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_results_parent_id_idx\` ON \`case_studies_results\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_results_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_results\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_results_locales_locale_parent_id_unique\` ON \`case_studies_results_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_hero_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_hero_actions_order_idx\` ON \`case_studies_blocks_hero_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_hero_actions_parent_id_idx\` ON \`case_studies_blocks_hero_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_hero_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_hero_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_hero_actions_locales_locale_parent_id_un\` ON \`case_studies_blocks_hero_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_hero\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`variant\` text DEFAULT 'default',
  	\`media_id\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_hero_order_idx\` ON \`case_studies_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_hero_parent_id_idx\` ON \`case_studies_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_hero_path_idx\` ON \`case_studies_blocks_hero\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_hero_media_idx\` ON \`case_studies_blocks_hero\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_hero_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`subheading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_hero_locales_locale_parent_id_unique\` ON \`case_studies_blocks_hero_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_feature_grid_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`icon\` text,
  	\`image_id\` integer,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_feature_grid_items_order_idx\` ON \`case_studies_blocks_feature_grid_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_feature_grid_items_parent_id_idx\` ON \`case_studies_blocks_feature_grid_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_feature_grid_items_image_idx\` ON \`case_studies_blocks_feature_grid_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_feature_grid_items_locales\` (
  	\`title\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_feature_grid_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_feature_grid_items_locales_locale_parent\` ON \`case_studies_blocks_feature_grid_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_feature_grid\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`columns\` text DEFAULT '3',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_feature_grid_order_idx\` ON \`case_studies_blocks_feature_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_feature_grid_parent_id_idx\` ON \`case_studies_blocks_feature_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_feature_grid_path_idx\` ON \`case_studies_blocks_feature_grid\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_feature_grid_locales\` (
  	\`heading\` text,
  	\`intro\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_feature_grid_locales_locale_parent_id_un\` ON \`case_studies_blocks_feature_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_media_text_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_media_text_actions_order_idx\` ON \`case_studies_blocks_media_text_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_media_text_actions_parent_id_idx\` ON \`case_studies_blocks_media_text_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_media_text_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_media_text_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_media_text_actions_locales_locale_parent\` ON \`case_studies_blocks_media_text_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_media_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	\`media_position\` text DEFAULT 'left',
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_media_text_order_idx\` ON \`case_studies_blocks_media_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_media_text_parent_id_idx\` ON \`case_studies_blocks_media_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_media_text_path_idx\` ON \`case_studies_blocks_media_text\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_media_text_media_idx\` ON \`case_studies_blocks_media_text\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_media_text_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_media_text_locales_locale_parent_id_uniq\` ON \`case_studies_blocks_media_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_spec_table_groups_rows\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_spec_table_groups_rows_order_idx\` ON \`case_studies_blocks_spec_table_groups_rows\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_spec_table_groups_rows_parent_id_idx\` ON \`case_studies_blocks_spec_table_groups_rows\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_spec_table_groups_rows_locales\` (
  	\`label\` text,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_spec_table_groups_rows\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_spec_table_groups_rows_locales_locale_pa\` ON \`case_studies_blocks_spec_table_groups_rows_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_spec_table_groups\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_spec_table_groups_order_idx\` ON \`case_studies_blocks_spec_table_groups\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_spec_table_groups_parent_id_idx\` ON \`case_studies_blocks_spec_table_groups\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_spec_table_groups_locales\` (
  	\`title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_spec_table_groups_locales_locale_parent_\` ON \`case_studies_blocks_spec_table_groups_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_spec_table\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_spec_table_order_idx\` ON \`case_studies_blocks_spec_table\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_spec_table_parent_id_idx\` ON \`case_studies_blocks_spec_table\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_spec_table_path_idx\` ON \`case_studies_blocks_spec_table\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_spec_table_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_spec_table_locales_locale_parent_id_uniq\` ON \`case_studies_blocks_spec_table_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_stats_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`value\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_stats_items_order_idx\` ON \`case_studies_blocks_stats_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_stats_items_parent_id_idx\` ON \`case_studies_blocks_stats_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_stats_items_locales\` (
  	\`label\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_stats_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_stats_items_locales_locale_parent_id_uni\` ON \`case_studies_blocks_stats_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_stats\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_stats_order_idx\` ON \`case_studies_blocks_stats\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_stats_parent_id_idx\` ON \`case_studies_blocks_stats\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_stats_path_idx\` ON \`case_studies_blocks_stats\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_stats_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_stats_locales_locale_parent_id_unique\` ON \`case_studies_blocks_stats_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_logo_wall_logos\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`logo_id\` integer,
  	\`name\` text,
  	\`url\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_logo_wall_logos_order_idx\` ON \`case_studies_blocks_logo_wall_logos\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_logo_wall_logos_parent_id_idx\` ON \`case_studies_blocks_logo_wall_logos\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_logo_wall_logos_logo_idx\` ON \`case_studies_blocks_logo_wall_logos\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_logo_wall\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'manual',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_logo_wall_order_idx\` ON \`case_studies_blocks_logo_wall\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_logo_wall_parent_id_idx\` ON \`case_studies_blocks_logo_wall\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_logo_wall_path_idx\` ON \`case_studies_blocks_logo_wall\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_logo_wall_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_logo_wall_locales_locale_parent_id_uniqu\` ON \`case_studies_blocks_logo_wall_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_cta_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_cta_actions_order_idx\` ON \`case_studies_blocks_cta_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_cta_actions_parent_id_idx\` ON \`case_studies_blocks_cta_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_cta_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_cta_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_cta_actions_locales_locale_parent_id_uni\` ON \`case_studies_blocks_cta_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_cta\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`style\` text DEFAULT 'banner',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_cta_order_idx\` ON \`case_studies_blocks_cta\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_cta_parent_id_idx\` ON \`case_studies_blocks_cta\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_cta_path_idx\` ON \`case_studies_blocks_cta\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_cta_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_cta_locales_locale_parent_id_unique\` ON \`case_studies_blocks_cta_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_faq_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_faq_items_order_idx\` ON \`case_studies_blocks_faq_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_faq_items_parent_id_idx\` ON \`case_studies_blocks_faq_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_faq_items_locales\` (
  	\`question\` text,
  	\`answer\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_faq_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_faq_items_locales_locale_parent_id_uniqu\` ON \`case_studies_blocks_faq_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_faq\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'collection',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_faq_order_idx\` ON \`case_studies_blocks_faq\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_faq_parent_id_idx\` ON \`case_studies_blocks_faq\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_faq_path_idx\` ON \`case_studies_blocks_faq\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_faq_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_faq_locales_locale_parent_id_unique\` ON \`case_studies_blocks_faq_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_rich_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`width\` text DEFAULT 'normal',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_rich_text_order_idx\` ON \`case_studies_blocks_rich_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_rich_text_parent_id_idx\` ON \`case_studies_blocks_rich_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_rich_text_path_idx\` ON \`case_studies_blocks_rich_text\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_rich_text_locales\` (
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_rich_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_rich_text_locales_locale_parent_id_uniqu\` ON \`case_studies_blocks_rich_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_video_embed\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`poster_id\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`poster_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_video_embed_order_idx\` ON \`case_studies_blocks_video_embed\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_video_embed_parent_id_idx\` ON \`case_studies_blocks_video_embed\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_video_embed_path_idx\` ON \`case_studies_blocks_video_embed\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_video_embed_poster_idx\` ON \`case_studies_blocks_video_embed\` (\`poster_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_video_embed_locales\` (
  	\`heading\` text,
  	\`url\` text,
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_video_embed\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_video_embed_locales_locale_parent_id_uni\` ON \`case_studies_blocks_video_embed_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`customer_name\` text,
  	\`customer_logo_id\` integer,
  	\`testimonial_author\` text,
  	\`industry_id\` integer,
  	\`featured\` integer DEFAULT false,
  	\`published_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`customer_logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_customer_logo_idx\` ON \`case_studies\` (\`customer_logo_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_industry_idx\` ON \`case_studies\` (\`industry_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_published_at_idx\` ON \`case_studies\` (\`published_at\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_updated_at_idx\` ON \`case_studies\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_created_at_idx\` ON \`case_studies\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`case_studies__status_idx\` ON \`case_studies\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_locales\` (
  	\`title\` text,
  	\`summary\` text,
  	\`challenge\` text,
  	\`solution\` text,
  	\`testimonial_quote\` text,
  	\`testimonial_role\` text,
  	\`meta_title\` text,
  	\`meta_description\` text,
  	\`meta_image_id\` integer,
  	\`slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_meta_meta_image_idx\` ON \`case_studies_locales\` (\`meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_slug_idx\` ON \`case_studies_locales\` (\`slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_locales_locale_parent_id_unique\` ON \`case_studies_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_rels\` (
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
  	\`partners_id\` integer,
  	\`faqs_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`product_families_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`solutions_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`industries_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`case_studies_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`careers_id\`) REFERENCES \`careers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`docs_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`partners_id\`) REFERENCES \`partners\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`faqs_id\`) REFERENCES \`faqs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_rels_order_idx\` ON \`case_studies_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_rels_parent_idx\` ON \`case_studies_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_rels_path_idx\` ON \`case_studies_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_rels_pages_id_idx\` ON \`case_studies_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_rels_products_id_idx\` ON \`case_studies_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_rels_product_families_id_idx\` ON \`case_studies_rels\` (\`product_families_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_rels_solutions_id_idx\` ON \`case_studies_rels\` (\`solutions_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_rels_industries_id_idx\` ON \`case_studies_rels\` (\`industries_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_rels_case_studies_id_idx\` ON \`case_studies_rels\` (\`case_studies_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_rels_posts_id_idx\` ON \`case_studies_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_rels_careers_id_idx\` ON \`case_studies_rels\` (\`careers_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_rels_docs_id_idx\` ON \`case_studies_rels\` (\`docs_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_rels_partners_id_idx\` ON \`case_studies_rels\` (\`partners_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_rels_faqs_id_idx\` ON \`case_studies_rels\` (\`faqs_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_version_results\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`value\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_version_results_order_idx\` ON \`_case_studies_v_version_results\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_version_results_parent_id_idx\` ON \`_case_studies_v_version_results\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_version_results_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_version_results\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_version_results_locales_locale_parent_id_uni\` ON \`_case_studies_v_version_results_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_hero_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_hero_actions_order_idx\` ON \`_case_studies_v_blocks_hero_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_hero_actions_parent_id_idx\` ON \`_case_studies_v_blocks_hero_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_hero_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_hero_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_hero_actions_locales_locale_parent_id\` ON \`_case_studies_v_blocks_hero_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_hero\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`variant\` text DEFAULT 'default',
  	\`media_id\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_hero_order_idx\` ON \`_case_studies_v_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_hero_parent_id_idx\` ON \`_case_studies_v_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_hero_path_idx\` ON \`_case_studies_v_blocks_hero\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_hero_media_idx\` ON \`_case_studies_v_blocks_hero\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_hero_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`subheading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_hero_locales_locale_parent_id_unique\` ON \`_case_studies_v_blocks_hero_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_feature_grid_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`icon\` text,
  	\`image_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_feature_grid_items_order_idx\` ON \`_case_studies_v_blocks_feature_grid_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_feature_grid_items_parent_id_idx\` ON \`_case_studies_v_blocks_feature_grid_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_feature_grid_items_image_idx\` ON \`_case_studies_v_blocks_feature_grid_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_feature_grid_items_locales\` (
  	\`title\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_feature_grid_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_feature_grid_items_locales_locale_par\` ON \`_case_studies_v_blocks_feature_grid_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_feature_grid\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`columns\` text DEFAULT '3',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_feature_grid_order_idx\` ON \`_case_studies_v_blocks_feature_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_feature_grid_parent_id_idx\` ON \`_case_studies_v_blocks_feature_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_feature_grid_path_idx\` ON \`_case_studies_v_blocks_feature_grid\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_feature_grid_locales\` (
  	\`heading\` text,
  	\`intro\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_feature_grid_locales_locale_parent_id\` ON \`_case_studies_v_blocks_feature_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_media_text_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_media_text_actions_order_idx\` ON \`_case_studies_v_blocks_media_text_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_media_text_actions_parent_id_idx\` ON \`_case_studies_v_blocks_media_text_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_media_text_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_media_text_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_media_text_actions_locales_locale_par\` ON \`_case_studies_v_blocks_media_text_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_media_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	\`media_position\` text DEFAULT 'left',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_media_text_order_idx\` ON \`_case_studies_v_blocks_media_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_media_text_parent_id_idx\` ON \`_case_studies_v_blocks_media_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_media_text_path_idx\` ON \`_case_studies_v_blocks_media_text\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_media_text_media_idx\` ON \`_case_studies_v_blocks_media_text\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_media_text_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_media_text_locales_locale_parent_id_u\` ON \`_case_studies_v_blocks_media_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_spec_table_groups_rows\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_spec_table_groups_rows_order_idx\` ON \`_case_studies_v_blocks_spec_table_groups_rows\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_spec_table_groups_rows_parent_id_idx\` ON \`_case_studies_v_blocks_spec_table_groups_rows\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_spec_table_groups_rows_locales\` (
  	\`label\` text,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_spec_table_groups_rows\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_spec_table_groups_rows_locales_locale\` ON \`_case_studies_v_blocks_spec_table_groups_rows_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_spec_table_groups\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_spec_table_groups_order_idx\` ON \`_case_studies_v_blocks_spec_table_groups\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_spec_table_groups_parent_id_idx\` ON \`_case_studies_v_blocks_spec_table_groups\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_spec_table_groups_locales\` (
  	\`title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_spec_table_groups_locales_locale_pare\` ON \`_case_studies_v_blocks_spec_table_groups_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_spec_table\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_spec_table_order_idx\` ON \`_case_studies_v_blocks_spec_table\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_spec_table_parent_id_idx\` ON \`_case_studies_v_blocks_spec_table\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_spec_table_path_idx\` ON \`_case_studies_v_blocks_spec_table\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_spec_table_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_spec_table_locales_locale_parent_id_u\` ON \`_case_studies_v_blocks_spec_table_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_stats_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`value\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_stats_items_order_idx\` ON \`_case_studies_v_blocks_stats_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_stats_items_parent_id_idx\` ON \`_case_studies_v_blocks_stats_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_stats_items_locales\` (
  	\`label\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_stats_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_stats_items_locales_locale_parent_id_\` ON \`_case_studies_v_blocks_stats_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_stats\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_stats_order_idx\` ON \`_case_studies_v_blocks_stats\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_stats_parent_id_idx\` ON \`_case_studies_v_blocks_stats\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_stats_path_idx\` ON \`_case_studies_v_blocks_stats\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_stats_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_stats_locales_locale_parent_id_unique\` ON \`_case_studies_v_blocks_stats_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_logo_wall_logos\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`logo_id\` integer,
  	\`name\` text,
  	\`url\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_logo_wall_logos_order_idx\` ON \`_case_studies_v_blocks_logo_wall_logos\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_logo_wall_logos_parent_id_idx\` ON \`_case_studies_v_blocks_logo_wall_logos\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_logo_wall_logos_logo_idx\` ON \`_case_studies_v_blocks_logo_wall_logos\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_logo_wall\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'manual',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_logo_wall_order_idx\` ON \`_case_studies_v_blocks_logo_wall\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_logo_wall_parent_id_idx\` ON \`_case_studies_v_blocks_logo_wall\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_logo_wall_path_idx\` ON \`_case_studies_v_blocks_logo_wall\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_logo_wall_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_logo_wall_locales_locale_parent_id_un\` ON \`_case_studies_v_blocks_logo_wall_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_cta_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_cta_actions_order_idx\` ON \`_case_studies_v_blocks_cta_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_cta_actions_parent_id_idx\` ON \`_case_studies_v_blocks_cta_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_cta_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_cta_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_cta_actions_locales_locale_parent_id_\` ON \`_case_studies_v_blocks_cta_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_cta\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`style\` text DEFAULT 'banner',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_cta_order_idx\` ON \`_case_studies_v_blocks_cta\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_cta_parent_id_idx\` ON \`_case_studies_v_blocks_cta\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_cta_path_idx\` ON \`_case_studies_v_blocks_cta\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_cta_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_cta_locales_locale_parent_id_unique\` ON \`_case_studies_v_blocks_cta_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_faq_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_faq_items_order_idx\` ON \`_case_studies_v_blocks_faq_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_faq_items_parent_id_idx\` ON \`_case_studies_v_blocks_faq_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_faq_items_locales\` (
  	\`question\` text,
  	\`answer\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_faq_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_faq_items_locales_locale_parent_id_un\` ON \`_case_studies_v_blocks_faq_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_faq\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'collection',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_faq_order_idx\` ON \`_case_studies_v_blocks_faq\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_faq_parent_id_idx\` ON \`_case_studies_v_blocks_faq\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_faq_path_idx\` ON \`_case_studies_v_blocks_faq\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_faq_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_faq_locales_locale_parent_id_unique\` ON \`_case_studies_v_blocks_faq_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_rich_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`width\` text DEFAULT 'normal',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_rich_text_order_idx\` ON \`_case_studies_v_blocks_rich_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_rich_text_parent_id_idx\` ON \`_case_studies_v_blocks_rich_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_rich_text_path_idx\` ON \`_case_studies_v_blocks_rich_text\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_rich_text_locales\` (
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_rich_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_rich_text_locales_locale_parent_id_un\` ON \`_case_studies_v_blocks_rich_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_video_embed\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`poster_id\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`poster_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_video_embed_order_idx\` ON \`_case_studies_v_blocks_video_embed\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_video_embed_parent_id_idx\` ON \`_case_studies_v_blocks_video_embed\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_video_embed_path_idx\` ON \`_case_studies_v_blocks_video_embed\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_video_embed_poster_idx\` ON \`_case_studies_v_blocks_video_embed\` (\`poster_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_video_embed_locales\` (
  	\`heading\` text,
  	\`url\` text,
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_video_embed\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_video_embed_locales_locale_parent_id_\` ON \`_case_studies_v_blocks_video_embed_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_customer_name\` text,
  	\`version_customer_logo_id\` integer,
  	\`version_testimonial_author\` text,
  	\`version_industry_id\` integer,
  	\`version_featured\` integer DEFAULT false,
  	\`version_published_at\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`snapshot\` integer,
  	\`published_locale\` text,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_customer_logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_parent_idx\` ON \`_case_studies_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_version_version_customer_logo_idx\` ON \`_case_studies_v\` (\`version_customer_logo_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_version_version_industry_idx\` ON \`_case_studies_v\` (\`version_industry_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_version_version_published_at_idx\` ON \`_case_studies_v\` (\`version_published_at\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_version_version_updated_at_idx\` ON \`_case_studies_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_version_version_created_at_idx\` ON \`_case_studies_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_version_version__status_idx\` ON \`_case_studies_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_created_at_idx\` ON \`_case_studies_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_updated_at_idx\` ON \`_case_studies_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_snapshot_idx\` ON \`_case_studies_v\` (\`snapshot\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_published_locale_idx\` ON \`_case_studies_v\` (\`published_locale\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_latest_idx\` ON \`_case_studies_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_locales\` (
  	\`version_title\` text,
  	\`version_summary\` text,
  	\`version_challenge\` text,
  	\`version_solution\` text,
  	\`version_testimonial_quote\` text,
  	\`version_testimonial_role\` text,
  	\`version_meta_title\` text,
  	\`version_meta_description\` text,
  	\`version_meta_image_id\` integer,
  	\`version_slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`version_meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_version_meta_version_meta_image_idx\` ON \`_case_studies_v_locales\` (\`version_meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_version_version_slug_idx\` ON \`_case_studies_v_locales\` (\`version_slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_locales_locale_parent_id_unique\` ON \`_case_studies_v_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_rels\` (
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
  	\`partners_id\` integer,
  	\`faqs_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`product_families_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`solutions_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`industries_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`case_studies_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`careers_id\`) REFERENCES \`careers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`docs_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`partners_id\`) REFERENCES \`partners\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`faqs_id\`) REFERENCES \`faqs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_rels_order_idx\` ON \`_case_studies_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_rels_parent_idx\` ON \`_case_studies_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_rels_path_idx\` ON \`_case_studies_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_rels_pages_id_idx\` ON \`_case_studies_v_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_rels_products_id_idx\` ON \`_case_studies_v_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_rels_product_families_id_idx\` ON \`_case_studies_v_rels\` (\`product_families_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_rels_solutions_id_idx\` ON \`_case_studies_v_rels\` (\`solutions_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_rels_industries_id_idx\` ON \`_case_studies_v_rels\` (\`industries_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_rels_case_studies_id_idx\` ON \`_case_studies_v_rels\` (\`case_studies_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_rels_posts_id_idx\` ON \`_case_studies_v_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_rels_careers_id_idx\` ON \`_case_studies_v_rels\` (\`careers_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_rels_docs_id_idx\` ON \`_case_studies_v_rels\` (\`docs_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_rels_partners_id_idx\` ON \`_case_studies_v_rels\` (\`partners_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_rels_faqs_id_idx\` ON \`_case_studies_v_rels\` (\`faqs_id\`);`)
  await db.run(sql`CREATE TABLE \`posts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`cover_image_id\` integer,
  	\`category\` text DEFAULT 'news',
  	\`author_id\` integer,
  	\`published_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`cover_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`author_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`posts_cover_image_idx\` ON \`posts\` (\`cover_image_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_author_idx\` ON \`posts\` (\`author_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_published_at_idx\` ON \`posts\` (\`published_at\`);`)
  await db.run(sql`CREATE INDEX \`posts_updated_at_idx\` ON \`posts\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`posts_created_at_idx\` ON \`posts\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`posts__status_idx\` ON \`posts\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`posts_locales\` (
  	\`title\` text,
  	\`excerpt\` text,
  	\`content\` text,
  	\`meta_title\` text,
  	\`meta_description\` text,
  	\`meta_image_id\` integer,
  	\`slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`posts_meta_meta_image_idx\` ON \`posts_locales\` (\`meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`posts_slug_idx\` ON \`posts_locales\` (\`slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`posts_locales_locale_parent_id_unique\` ON \`posts_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`posts_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`products_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`posts_rels_order_idx\` ON \`posts_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_parent_idx\` ON \`posts_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_path_idx\` ON \`posts_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_products_id_idx\` ON \`posts_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE TABLE \`_posts_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_cover_image_id\` integer,
  	\`version_category\` text DEFAULT 'news',
  	\`version_author_id\` integer,
  	\`version_published_at\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`snapshot\` integer,
  	\`published_locale\` text,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_cover_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_author_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_posts_v_parent_idx\` ON \`_posts_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_cover_image_idx\` ON \`_posts_v\` (\`version_cover_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_author_idx\` ON \`_posts_v\` (\`version_author_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_published_at_idx\` ON \`_posts_v\` (\`version_published_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_updated_at_idx\` ON \`_posts_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_created_at_idx\` ON \`_posts_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version__status_idx\` ON \`_posts_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_created_at_idx\` ON \`_posts_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_updated_at_idx\` ON \`_posts_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_snapshot_idx\` ON \`_posts_v\` (\`snapshot\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_published_locale_idx\` ON \`_posts_v\` (\`published_locale\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_latest_idx\` ON \`_posts_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_posts_v_locales\` (
  	\`version_title\` text,
  	\`version_excerpt\` text,
  	\`version_content\` text,
  	\`version_meta_title\` text,
  	\`version_meta_description\` text,
  	\`version_meta_image_id\` integer,
  	\`version_slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`version_meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_posts_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_posts_v_version_meta_version_meta_image_idx\` ON \`_posts_v_locales\` (\`version_meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_slug_idx\` ON \`_posts_v_locales\` (\`version_slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`_posts_v_locales_locale_parent_id_unique\` ON \`_posts_v_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_posts_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`products_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_posts_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_order_idx\` ON \`_posts_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_parent_idx\` ON \`_posts_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_path_idx\` ON \`_posts_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_products_id_idx\` ON \`_posts_v_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE TABLE \`careers\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`employment_type\` text DEFAULT 'full-time',
  	\`work_mode\` text DEFAULT 'onsite',
  	\`application_form_id\` integer,
  	\`is_open\` integer DEFAULT true,
  	\`published_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`application_form_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`careers_application_form_idx\` ON \`careers\` (\`application_form_id\`);`)
  await db.run(sql`CREATE INDEX \`careers_is_open_idx\` ON \`careers\` (\`is_open\`);`)
  await db.run(sql`CREATE INDEX \`careers_published_at_idx\` ON \`careers\` (\`published_at\`);`)
  await db.run(sql`CREATE INDEX \`careers_updated_at_idx\` ON \`careers\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`careers_created_at_idx\` ON \`careers\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`careers_locales\` (
  	\`title\` text NOT NULL,
  	\`department\` text,
  	\`location\` text,
  	\`summary\` text,
  	\`description\` text,
  	\`meta_title\` text,
  	\`meta_description\` text,
  	\`meta_image_id\` integer,
  	\`slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`careers\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`careers_meta_meta_image_idx\` ON \`careers_locales\` (\`meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`careers_slug_idx\` ON \`careers_locales\` (\`slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`careers_locales_locale_parent_id_unique\` ON \`careers_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`partners\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`logo_id\` integer,
  	\`website\` text,
  	\`tier\` text DEFAULT 'reseller',
  	\`country\` text,
  	\`city\` text,
  	\`sort_order\` numeric DEFAULT 0,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`partners_logo_idx\` ON \`partners\` (\`logo_id\`);`)
  await db.run(sql`CREATE INDEX \`partners_sort_order_idx\` ON \`partners\` (\`sort_order\`);`)
  await db.run(sql`CREATE INDEX \`partners_updated_at_idx\` ON \`partners\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`partners_created_at_idx\` ON \`partners\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`partners_locales\` (
  	\`description\` text,
  	\`slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`partners\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`partners_slug_idx\` ON \`partners_locales\` (\`slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`partners_locales_locale_parent_id_unique\` ON \`partners_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_hero_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_hero_actions_order_idx\` ON \`pages_blocks_hero_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_hero_actions_parent_id_idx\` ON \`pages_blocks_hero_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_hero_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_hero_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_hero_actions_locales_locale_parent_id_unique\` ON \`pages_blocks_hero_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_hero\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`variant\` text DEFAULT 'default',
  	\`media_id\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_hero_order_idx\` ON \`pages_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_hero_parent_id_idx\` ON \`pages_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_hero_path_idx\` ON \`pages_blocks_hero\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_hero_media_idx\` ON \`pages_blocks_hero\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_hero_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`subheading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_hero_locales_locale_parent_id_unique\` ON \`pages_blocks_hero_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_feature_grid_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`icon\` text,
  	\`image_id\` integer,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_feature_grid_items_order_idx\` ON \`pages_blocks_feature_grid_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_feature_grid_items_parent_id_idx\` ON \`pages_blocks_feature_grid_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_feature_grid_items_image_idx\` ON \`pages_blocks_feature_grid_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_feature_grid_items_locales\` (
  	\`title\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_feature_grid_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_feature_grid_items_locales_locale_parent_id_uni\` ON \`pages_blocks_feature_grid_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_feature_grid\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`columns\` text DEFAULT '3',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_feature_grid_order_idx\` ON \`pages_blocks_feature_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_feature_grid_parent_id_idx\` ON \`pages_blocks_feature_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_feature_grid_path_idx\` ON \`pages_blocks_feature_grid\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_feature_grid_locales\` (
  	\`heading\` text,
  	\`intro\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_feature_grid_locales_locale_parent_id_unique\` ON \`pages_blocks_feature_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_media_text_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_media_text_actions_order_idx\` ON \`pages_blocks_media_text_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_media_text_actions_parent_id_idx\` ON \`pages_blocks_media_text_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_media_text_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_media_text_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_media_text_actions_locales_locale_parent_id_uni\` ON \`pages_blocks_media_text_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_media_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	\`media_position\` text DEFAULT 'left',
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_media_text_order_idx\` ON \`pages_blocks_media_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_media_text_parent_id_idx\` ON \`pages_blocks_media_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_media_text_path_idx\` ON \`pages_blocks_media_text\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_media_text_media_idx\` ON \`pages_blocks_media_text\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_media_text_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_media_text_locales_locale_parent_id_unique\` ON \`pages_blocks_media_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_spec_table_groups_rows\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_spec_table_groups_rows_order_idx\` ON \`pages_blocks_spec_table_groups_rows\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_spec_table_groups_rows_parent_id_idx\` ON \`pages_blocks_spec_table_groups_rows\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_spec_table_groups_rows_locales\` (
  	\`label\` text,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_spec_table_groups_rows\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_spec_table_groups_rows_locales_locale_parent_id\` ON \`pages_blocks_spec_table_groups_rows_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_spec_table_groups\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_spec_table_groups_order_idx\` ON \`pages_blocks_spec_table_groups\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_spec_table_groups_parent_id_idx\` ON \`pages_blocks_spec_table_groups\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_spec_table_groups_locales\` (
  	\`title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_spec_table_groups_locales_locale_parent_id_uniq\` ON \`pages_blocks_spec_table_groups_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_spec_table\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_spec_table_order_idx\` ON \`pages_blocks_spec_table\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_spec_table_parent_id_idx\` ON \`pages_blocks_spec_table\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_spec_table_path_idx\` ON \`pages_blocks_spec_table\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_spec_table_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_spec_table_locales_locale_parent_id_unique\` ON \`pages_blocks_spec_table_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_stats_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`value\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_stats_items_order_idx\` ON \`pages_blocks_stats_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_stats_items_parent_id_idx\` ON \`pages_blocks_stats_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_stats_items_locales\` (
  	\`label\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_stats_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_stats_items_locales_locale_parent_id_unique\` ON \`pages_blocks_stats_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_stats\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_stats_order_idx\` ON \`pages_blocks_stats\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_stats_parent_id_idx\` ON \`pages_blocks_stats\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_stats_path_idx\` ON \`pages_blocks_stats\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_stats_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_stats_locales_locale_parent_id_unique\` ON \`pages_blocks_stats_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_logo_wall_logos\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`logo_id\` integer,
  	\`name\` text,
  	\`url\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_logo_wall_logos_order_idx\` ON \`pages_blocks_logo_wall_logos\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_logo_wall_logos_parent_id_idx\` ON \`pages_blocks_logo_wall_logos\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_logo_wall_logos_logo_idx\` ON \`pages_blocks_logo_wall_logos\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_logo_wall\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'manual',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_logo_wall_order_idx\` ON \`pages_blocks_logo_wall\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_logo_wall_parent_id_idx\` ON \`pages_blocks_logo_wall\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_logo_wall_path_idx\` ON \`pages_blocks_logo_wall\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_logo_wall_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_logo_wall_locales_locale_parent_id_unique\` ON \`pages_blocks_logo_wall_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_cta_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_cta_actions_order_idx\` ON \`pages_blocks_cta_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_cta_actions_parent_id_idx\` ON \`pages_blocks_cta_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_cta_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_cta_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_cta_actions_locales_locale_parent_id_unique\` ON \`pages_blocks_cta_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_cta\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`style\` text DEFAULT 'banner',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_cta_order_idx\` ON \`pages_blocks_cta\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_cta_parent_id_idx\` ON \`pages_blocks_cta\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_cta_path_idx\` ON \`pages_blocks_cta\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_cta_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_cta_locales_locale_parent_id_unique\` ON \`pages_blocks_cta_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_faq_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_faq_items_order_idx\` ON \`pages_blocks_faq_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_faq_items_parent_id_idx\` ON \`pages_blocks_faq_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_faq_items_locales\` (
  	\`question\` text,
  	\`answer\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_faq_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_faq_items_locales_locale_parent_id_unique\` ON \`pages_blocks_faq_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_faq\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'collection',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_faq_order_idx\` ON \`pages_blocks_faq\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_faq_parent_id_idx\` ON \`pages_blocks_faq\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_faq_path_idx\` ON \`pages_blocks_faq\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_faq_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_faq_locales_locale_parent_id_unique\` ON \`pages_blocks_faq_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_rich_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`width\` text DEFAULT 'normal',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_rich_text_order_idx\` ON \`pages_blocks_rich_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_rich_text_parent_id_idx\` ON \`pages_blocks_rich_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_rich_text_path_idx\` ON \`pages_blocks_rich_text\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_rich_text_locales\` (
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_rich_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_rich_text_locales_locale_parent_id_unique\` ON \`pages_blocks_rich_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_video_embed\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`poster_id\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`poster_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_video_embed_order_idx\` ON \`pages_blocks_video_embed\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_video_embed_parent_id_idx\` ON \`pages_blocks_video_embed\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_video_embed_path_idx\` ON \`pages_blocks_video_embed\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_video_embed_poster_idx\` ON \`pages_blocks_video_embed\` (\`poster_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_video_embed_locales\` (
  	\`heading\` text,
  	\`url\` text,
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_video_embed\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_video_embed_locales_locale_parent_id_unique\` ON \`pages_blocks_video_embed_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`page_type\` text DEFAULT 'standard',
  	\`published_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_published_at_idx\` ON \`pages\` (\`published_at\`);`)
  await db.run(sql`CREATE INDEX \`pages_updated_at_idx\` ON \`pages\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`pages_created_at_idx\` ON \`pages\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`pages__status_idx\` ON \`pages\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`pages_locales\` (
  	\`title\` text,
  	\`meta_title\` text,
  	\`meta_description\` text,
  	\`meta_image_id\` integer,
  	\`slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_meta_meta_image_idx\` ON \`pages_locales\` (\`meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_slug_idx\` ON \`pages_locales\` (\`slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_locales_locale_parent_id_unique\` ON \`pages_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_rels\` (
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
  	\`partners_id\` integer,
  	\`faqs_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`product_families_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`solutions_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`industries_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`case_studies_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`careers_id\`) REFERENCES \`careers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`docs_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`partners_id\`) REFERENCES \`partners\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`faqs_id\`) REFERENCES \`faqs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_rels_order_idx\` ON \`pages_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_parent_idx\` ON \`pages_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_path_idx\` ON \`pages_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_pages_id_idx\` ON \`pages_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_products_id_idx\` ON \`pages_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_product_families_id_idx\` ON \`pages_rels\` (\`product_families_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_solutions_id_idx\` ON \`pages_rels\` (\`solutions_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_industries_id_idx\` ON \`pages_rels\` (\`industries_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_case_studies_id_idx\` ON \`pages_rels\` (\`case_studies_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_posts_id_idx\` ON \`pages_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_careers_id_idx\` ON \`pages_rels\` (\`careers_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_docs_id_idx\` ON \`pages_rels\` (\`docs_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_partners_id_idx\` ON \`pages_rels\` (\`partners_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_faqs_id_idx\` ON \`pages_rels\` (\`faqs_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_hero_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_hero_actions_order_idx\` ON \`_pages_v_blocks_hero_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_hero_actions_parent_id_idx\` ON \`_pages_v_blocks_hero_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_hero_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_hero_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_hero_actions_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_hero_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_hero\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`variant\` text DEFAULT 'default',
  	\`media_id\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_hero_order_idx\` ON \`_pages_v_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_hero_parent_id_idx\` ON \`_pages_v_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_hero_path_idx\` ON \`_pages_v_blocks_hero\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_hero_media_idx\` ON \`_pages_v_blocks_hero\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_hero_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`subheading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_hero_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_hero_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_feature_grid_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`icon\` text,
  	\`image_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_feature_grid_items_order_idx\` ON \`_pages_v_blocks_feature_grid_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_feature_grid_items_parent_id_idx\` ON \`_pages_v_blocks_feature_grid_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_feature_grid_items_image_idx\` ON \`_pages_v_blocks_feature_grid_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_feature_grid_items_locales\` (
  	\`title\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_feature_grid_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_feature_grid_items_locales_locale_parent_id_\` ON \`_pages_v_blocks_feature_grid_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_feature_grid\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`columns\` text DEFAULT '3',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_feature_grid_order_idx\` ON \`_pages_v_blocks_feature_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_feature_grid_parent_id_idx\` ON \`_pages_v_blocks_feature_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_feature_grid_path_idx\` ON \`_pages_v_blocks_feature_grid\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_feature_grid_locales\` (
  	\`heading\` text,
  	\`intro\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_feature_grid_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_feature_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_media_text_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_media_text_actions_order_idx\` ON \`_pages_v_blocks_media_text_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_media_text_actions_parent_id_idx\` ON \`_pages_v_blocks_media_text_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_media_text_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_media_text_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_media_text_actions_locales_locale_parent_id_\` ON \`_pages_v_blocks_media_text_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_media_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	\`media_position\` text DEFAULT 'left',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_media_text_order_idx\` ON \`_pages_v_blocks_media_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_media_text_parent_id_idx\` ON \`_pages_v_blocks_media_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_media_text_path_idx\` ON \`_pages_v_blocks_media_text\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_media_text_media_idx\` ON \`_pages_v_blocks_media_text\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_media_text_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_media_text_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_media_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_spec_table_groups_rows\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_spec_table_groups_rows_order_idx\` ON \`_pages_v_blocks_spec_table_groups_rows\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_spec_table_groups_rows_parent_id_idx\` ON \`_pages_v_blocks_spec_table_groups_rows\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_spec_table_groups_rows_locales\` (
  	\`label\` text,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_spec_table_groups_rows\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_spec_table_groups_rows_locales_locale_parent\` ON \`_pages_v_blocks_spec_table_groups_rows_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_spec_table_groups\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_spec_table_groups_order_idx\` ON \`_pages_v_blocks_spec_table_groups\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_spec_table_groups_parent_id_idx\` ON \`_pages_v_blocks_spec_table_groups\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_spec_table_groups_locales\` (
  	\`title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_spec_table_groups_locales_locale_parent_id_u\` ON \`_pages_v_blocks_spec_table_groups_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_spec_table\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_spec_table_order_idx\` ON \`_pages_v_blocks_spec_table\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_spec_table_parent_id_idx\` ON \`_pages_v_blocks_spec_table\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_spec_table_path_idx\` ON \`_pages_v_blocks_spec_table\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_spec_table_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_spec_table_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_spec_table_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_stats_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`value\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_stats_items_order_idx\` ON \`_pages_v_blocks_stats_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_stats_items_parent_id_idx\` ON \`_pages_v_blocks_stats_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_stats_items_locales\` (
  	\`label\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_stats_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_stats_items_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_stats_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_stats\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_stats_order_idx\` ON \`_pages_v_blocks_stats\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_stats_parent_id_idx\` ON \`_pages_v_blocks_stats\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_stats_path_idx\` ON \`_pages_v_blocks_stats\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_stats_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_stats_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_stats_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_logo_wall_logos\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`logo_id\` integer,
  	\`name\` text,
  	\`url\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_logo_wall_logos_order_idx\` ON \`_pages_v_blocks_logo_wall_logos\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_logo_wall_logos_parent_id_idx\` ON \`_pages_v_blocks_logo_wall_logos\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_logo_wall_logos_logo_idx\` ON \`_pages_v_blocks_logo_wall_logos\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_logo_wall\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'manual',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_logo_wall_order_idx\` ON \`_pages_v_blocks_logo_wall\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_logo_wall_parent_id_idx\` ON \`_pages_v_blocks_logo_wall\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_logo_wall_path_idx\` ON \`_pages_v_blocks_logo_wall\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_logo_wall_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_logo_wall_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_logo_wall_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_cta_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_appearance\` text DEFAULT 'primary',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_cta_actions_order_idx\` ON \`_pages_v_blocks_cta_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_cta_actions_parent_id_idx\` ON \`_pages_v_blocks_cta_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_cta_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_cta_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_cta_actions_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_cta_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_cta\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`style\` text DEFAULT 'banner',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_cta_order_idx\` ON \`_pages_v_blocks_cta\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_cta_parent_id_idx\` ON \`_pages_v_blocks_cta\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_cta_path_idx\` ON \`_pages_v_blocks_cta\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_cta_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_cta_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_cta_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_faq_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_faq_items_order_idx\` ON \`_pages_v_blocks_faq_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_faq_items_parent_id_idx\` ON \`_pages_v_blocks_faq_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_faq_items_locales\` (
  	\`question\` text,
  	\`answer\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_faq_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_faq_items_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_faq_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_faq\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'collection',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_faq_order_idx\` ON \`_pages_v_blocks_faq\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_faq_parent_id_idx\` ON \`_pages_v_blocks_faq\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_faq_path_idx\` ON \`_pages_v_blocks_faq\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_faq_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_faq_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_faq_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_rich_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`width\` text DEFAULT 'normal',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_rich_text_order_idx\` ON \`_pages_v_blocks_rich_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_rich_text_parent_id_idx\` ON \`_pages_v_blocks_rich_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_rich_text_path_idx\` ON \`_pages_v_blocks_rich_text\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_rich_text_locales\` (
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_rich_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_rich_text_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_rich_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_video_embed\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`poster_id\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`poster_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_video_embed_order_idx\` ON \`_pages_v_blocks_video_embed\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_video_embed_parent_id_idx\` ON \`_pages_v_blocks_video_embed\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_video_embed_path_idx\` ON \`_pages_v_blocks_video_embed\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_video_embed_poster_idx\` ON \`_pages_v_blocks_video_embed\` (\`poster_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_video_embed_locales\` (
  	\`heading\` text,
  	\`url\` text,
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_video_embed\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_video_embed_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_video_embed_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_page_type\` text DEFAULT 'standard',
  	\`version_published_at\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`snapshot\` integer,
  	\`published_locale\` text,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_parent_idx\` ON \`_pages_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_published_at_idx\` ON \`_pages_v\` (\`version_published_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_updated_at_idx\` ON \`_pages_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_created_at_idx\` ON \`_pages_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version__status_idx\` ON \`_pages_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_created_at_idx\` ON \`_pages_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_updated_at_idx\` ON \`_pages_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_snapshot_idx\` ON \`_pages_v\` (\`snapshot\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_published_locale_idx\` ON \`_pages_v\` (\`published_locale\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_latest_idx\` ON \`_pages_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_locales\` (
  	\`version_title\` text,
  	\`version_meta_title\` text,
  	\`version_meta_description\` text,
  	\`version_meta_image_id\` integer,
  	\`version_slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`version_meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_version_meta_version_meta_image_idx\` ON \`_pages_v_locales\` (\`version_meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_slug_idx\` ON \`_pages_v_locales\` (\`version_slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_locales_locale_parent_id_unique\` ON \`_pages_v_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_rels\` (
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
  	\`partners_id\` integer,
  	\`faqs_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`product_families_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`solutions_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`industries_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`case_studies_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`careers_id\`) REFERENCES \`careers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`docs_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`partners_id\`) REFERENCES \`partners\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`faqs_id\`) REFERENCES \`faqs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_order_idx\` ON \`_pages_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_parent_idx\` ON \`_pages_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_path_idx\` ON \`_pages_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_pages_id_idx\` ON \`_pages_v_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_products_id_idx\` ON \`_pages_v_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_product_families_id_idx\` ON \`_pages_v_rels\` (\`product_families_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_solutions_id_idx\` ON \`_pages_v_rels\` (\`solutions_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_industries_id_idx\` ON \`_pages_v_rels\` (\`industries_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_case_studies_id_idx\` ON \`_pages_v_rels\` (\`case_studies_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_posts_id_idx\` ON \`_pages_v_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_careers_id_idx\` ON \`_pages_v_rels\` (\`careers_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_docs_id_idx\` ON \`_pages_v_rels\` (\`docs_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_partners_id_idx\` ON \`_pages_v_rels\` (\`partners_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_faqs_id_idx\` ON \`_pages_v_rels\` (\`faqs_id\`);`)
  await db.run(sql`CREATE TABLE \`media\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`protected\` integer DEFAULT true NOT NULL,
  	\`visibility\` text DEFAULT 'public' NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric,
  	\`focal_x\` numeric,
  	\`focal_y\` numeric
  );
  `)
  await db.run(sql`CREATE INDEX \`media_protected_idx\` ON \`media\` (\`protected\`);`)
  await db.run(sql`CREATE INDEX \`media_visibility_idx\` ON \`media\` (\`visibility\`);`)
  await db.run(sql`CREATE INDEX \`media_updated_at_idx\` ON \`media\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`media_created_at_idx\` ON \`media\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_filename_idx\` ON \`media\` (\`filename\`);`)
  await db.run(sql`CREATE TABLE \`media_locales\` (
  	\`alt\` text NOT NULL,
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`media_locales_locale_parent_id_unique\` ON \`media_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`media_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`products_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`media_rels_order_idx\` ON \`media_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`media_rels_parent_idx\` ON \`media_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`media_rels_path_idx\` ON \`media_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`media_rels_products_id_idx\` ON \`media_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE TABLE \`docs\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`product_id\` integer,
  	\`parent_id\` integer,
  	\`applies_to_versions\` text,
  	\`sort_order\` numeric DEFAULT 0,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`docs_product_idx\` ON \`docs\` (\`product_id\`);`)
  await db.run(sql`CREATE INDEX \`docs_parent_idx\` ON \`docs\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`docs_sort_order_idx\` ON \`docs\` (\`sort_order\`);`)
  await db.run(sql`CREATE INDEX \`docs_updated_at_idx\` ON \`docs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`docs_created_at_idx\` ON \`docs\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`docs__status_idx\` ON \`docs\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`docs_locales\` (
  	\`title\` text,
  	\`excerpt\` text,
  	\`content\` text,
  	\`meta_title\` text,
  	\`meta_description\` text,
  	\`meta_image_id\` integer,
  	\`slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`docs_meta_meta_image_idx\` ON \`docs_locales\` (\`meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE INDEX \`docs_slug_idx\` ON \`docs_locales\` (\`slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`docs_locales_locale_parent_id_unique\` ON \`docs_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_docs_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_product_id\` integer,
  	\`version_parent_id\` integer,
  	\`version_applies_to_versions\` text,
  	\`version_sort_order\` numeric DEFAULT 0,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`snapshot\` integer,
  	\`published_locale\` text,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_parent_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_docs_v_parent_idx\` ON \`_docs_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_docs_v_version_version_product_idx\` ON \`_docs_v\` (\`version_product_id\`);`)
  await db.run(sql`CREATE INDEX \`_docs_v_version_version_parent_idx\` ON \`_docs_v\` (\`version_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_docs_v_version_version_sort_order_idx\` ON \`_docs_v\` (\`version_sort_order\`);`)
  await db.run(sql`CREATE INDEX \`_docs_v_version_version_updated_at_idx\` ON \`_docs_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_docs_v_version_version_created_at_idx\` ON \`_docs_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_docs_v_version_version__status_idx\` ON \`_docs_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_docs_v_created_at_idx\` ON \`_docs_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_docs_v_updated_at_idx\` ON \`_docs_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_docs_v_snapshot_idx\` ON \`_docs_v\` (\`snapshot\`);`)
  await db.run(sql`CREATE INDEX \`_docs_v_published_locale_idx\` ON \`_docs_v\` (\`published_locale\`);`)
  await db.run(sql`CREATE INDEX \`_docs_v_latest_idx\` ON \`_docs_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_docs_v_locales\` (
  	\`version_title\` text,
  	\`version_excerpt\` text,
  	\`version_content\` text,
  	\`version_meta_title\` text,
  	\`version_meta_description\` text,
  	\`version_meta_image_id\` integer,
  	\`version_slug\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`version_meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_docs_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_docs_v_version_meta_version_meta_image_idx\` ON \`_docs_v_locales\` (\`version_meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE INDEX \`_docs_v_version_version_slug_idx\` ON \`_docs_v_locales\` (\`version_slug\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`_docs_v_locales_locale_parent_id_unique\` ON \`_docs_v_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`releases_changes\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`type\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`releases\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`releases_changes_order_idx\` ON \`releases_changes\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`releases_changes_parent_id_idx\` ON \`releases_changes\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`releases_changes_locales\` (
  	\`description\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`releases_changes\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`releases_changes_locales_locale_parent_id_unique\` ON \`releases_changes_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`releases\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`product_id\` integer NOT NULL,
  	\`version\` text NOT NULL,
  	\`channel\` text DEFAULT 'stable',
  	\`release_date\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`releases_product_idx\` ON \`releases\` (\`product_id\`);`)
  await db.run(sql`CREATE INDEX \`releases_version_idx\` ON \`releases\` (\`version\`);`)
  await db.run(sql`CREATE INDEX \`releases_release_date_idx\` ON \`releases\` (\`release_date\`);`)
  await db.run(sql`CREATE INDEX \`releases_updated_at_idx\` ON \`releases\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`releases_created_at_idx\` ON \`releases\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`releases_locales\` (
  	\`title\` text,
  	\`notes\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`releases\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`releases_locales_locale_parent_id_unique\` ON \`releases_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`downloads\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`file_id\` integer NOT NULL,
  	\`product_id\` integer NOT NULL,
  	\`release_id\` integer,
  	\`os\` text NOT NULL,
  	\`arch\` text,
  	\`access\` text DEFAULT 'licensed' NOT NULL,
  	\`checksum_sha256\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`file_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`release_id\`) REFERENCES \`releases\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`downloads_file_idx\` ON \`downloads\` (\`file_id\`);`)
  await db.run(sql`CREATE INDEX \`downloads_product_idx\` ON \`downloads\` (\`product_id\`);`)
  await db.run(sql`CREATE INDEX \`downloads_release_idx\` ON \`downloads\` (\`release_id\`);`)
  await db.run(sql`CREATE INDEX \`downloads_os_idx\` ON \`downloads\` (\`os\`);`)
  await db.run(sql`CREATE INDEX \`downloads_access_idx\` ON \`downloads\` (\`access\`);`)
  await db.run(sql`CREATE INDEX \`downloads_updated_at_idx\` ON \`downloads\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`downloads_created_at_idx\` ON \`downloads\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`downloads_locales\` (
  	\`title\` text NOT NULL,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`downloads\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`downloads_locales_locale_parent_id_unique\` ON \`downloads_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`faqs\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`category\` text DEFAULT 'general',
  	\`product_id\` integer,
  	\`sort_order\` numeric DEFAULT 0,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`faqs_product_idx\` ON \`faqs\` (\`product_id\`);`)
  await db.run(sql`CREATE INDEX \`faqs_sort_order_idx\` ON \`faqs\` (\`sort_order\`);`)
  await db.run(sql`CREATE INDEX \`faqs_updated_at_idx\` ON \`faqs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`faqs_created_at_idx\` ON \`faqs\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`faqs_locales\` (
  	\`question\` text NOT NULL,
  	\`answer\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`faqs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`faqs_locales_locale_parent_id_unique\` ON \`faqs_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`support_tickets\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`subject\` text NOT NULL,
  	\`customer_id\` integer NOT NULL,
  	\`product_id\` integer,
  	\`status\` text DEFAULT 'open' NOT NULL,
  	\`priority\` text DEFAULT 'normal' NOT NULL,
  	\`last_message_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`support_tickets_customer_idx\` ON \`support_tickets\` (\`customer_id\`);`)
  await db.run(sql`CREATE INDEX \`support_tickets_product_idx\` ON \`support_tickets\` (\`product_id\`);`)
  await db.run(sql`CREATE INDEX \`support_tickets_status_idx\` ON \`support_tickets\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`support_tickets_last_message_at_idx\` ON \`support_tickets\` (\`last_message_at\`);`)
  await db.run(sql`CREATE INDEX \`support_tickets_updated_at_idx\` ON \`support_tickets\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`support_tickets_created_at_idx\` ON \`support_tickets\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`support_ticket_messages\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`ticket_id\` integer NOT NULL,
  	\`author\` text NOT NULL,
  	\`staff_user_id\` integer,
  	\`body\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`ticket_id\`) REFERENCES \`support_tickets\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`staff_user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`support_ticket_messages_ticket_idx\` ON \`support_ticket_messages\` (\`ticket_id\`);`)
  await db.run(sql`CREATE INDEX \`support_ticket_messages_staff_user_idx\` ON \`support_ticket_messages\` (\`staff_user_id\`);`)
  await db.run(sql`CREATE INDEX \`support_ticket_messages_updated_at_idx\` ON \`support_ticket_messages\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`support_ticket_messages_created_at_idx\` ON \`support_ticket_messages\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`orders_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`edition_id\` integer NOT NULL,
  	\`sku\` text NOT NULL,
  	\`name\` text NOT NULL,
  	\`unit_amount\` numeric NOT NULL,
  	\`quantity\` numeric DEFAULT 1 NOT NULL,
  	\`seats\` numeric,
  	\`line_total\` numeric,
  	FOREIGN KEY (\`edition_id\`) REFERENCES \`editions\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`orders_items_order_idx\` ON \`orders_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`orders_items_parent_id_idx\` ON \`orders_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`orders_items_edition_idx\` ON \`orders_items\` (\`edition_id\`);`)
  await db.run(sql`CREATE TABLE \`orders_webhook_events\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`event_id\` text NOT NULL,
  	\`type\` text,
  	\`received_at\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`orders_webhook_events_order_idx\` ON \`orders_webhook_events\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`orders_webhook_events_parent_id_idx\` ON \`orders_webhook_events\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`orders\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order_number\` text,
  	\`customer_id\` integer NOT NULL,
  	\`currency\` text NOT NULL,
  	\`total\` numeric,
  	\`vat_amount\` numeric,
  	\`provider\` text NOT NULL,
  	\`provider_ref\` text,
  	\`idempotency_key\` text NOT NULL,
  	\`status\` text DEFAULT 'pending' NOT NULL,
  	\`paid_at\` text,
  	\`failure_reason\` text,
  	\`locale\` text DEFAULT 'tr',
  	\`billing_name\` text,
  	\`billing_company\` text,
  	\`billing_tax_number\` text,
  	\`billing_tax_office\` text,
  	\`billing_email\` text,
  	\`billing_phone\` text,
  	\`billing_address\` text,
  	\`billing_city\` text,
  	\`billing_country\` text,
  	\`consents_distance_sales_accepted_at\` text,
  	\`consents_pre_information_accepted_at\` text,
  	\`consents_ip\` text,
  	\`consents_user_agent\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`orders_order_number_idx\` ON \`orders\` (\`order_number\`);`)
  await db.run(sql`CREATE INDEX \`orders_customer_idx\` ON \`orders\` (\`customer_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`orders_provider_ref_idx\` ON \`orders\` (\`provider_ref\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`orders_idempotency_key_idx\` ON \`orders\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`orders_status_idx\` ON \`orders\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`orders_updated_at_idx\` ON \`orders\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`orders_created_at_idx\` ON \`orders\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`licenses\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`customer_id\` integer NOT NULL,
  	\`edition_id\` integer NOT NULL,
  	\`product_id\` integer,
  	\`order_id\` integer,
  	\`starts_at\` text NOT NULL,
  	\`expires_at\` text,
  	\`seats\` numeric,
  	\`status\` text DEFAULT 'active' NOT NULL,
  	\`notes\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`edition_id\`) REFERENCES \`editions\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`licenses_key_idx\` ON \`licenses\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`licenses_customer_idx\` ON \`licenses\` (\`customer_id\`);`)
  await db.run(sql`CREATE INDEX \`licenses_edition_idx\` ON \`licenses\` (\`edition_id\`);`)
  await db.run(sql`CREATE INDEX \`licenses_product_idx\` ON \`licenses\` (\`product_id\`);`)
  await db.run(sql`CREATE INDEX \`licenses_order_idx\` ON \`licenses\` (\`order_id\`);`)
  await db.run(sql`CREATE INDEX \`licenses_starts_at_idx\` ON \`licenses\` (\`starts_at\`);`)
  await db.run(sql`CREATE INDEX \`licenses_expires_at_idx\` ON \`licenses\` (\`expires_at\`);`)
  await db.run(sql`CREATE INDEX \`licenses_status_idx\` ON \`licenses\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`licenses_updated_at_idx\` ON \`licenses\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`licenses_created_at_idx\` ON \`licenses\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_checkbox\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`default_value\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_checkbox_order_idx\` ON \`forms_blocks_checkbox\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_checkbox_parent_id_idx\` ON \`forms_blocks_checkbox\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_checkbox_path_idx\` ON \`forms_blocks_checkbox\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_checkbox_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_checkbox\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_checkbox_locales_locale_parent_id_unique\` ON \`forms_blocks_checkbox_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_country\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_country_order_idx\` ON \`forms_blocks_country\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_country_parent_id_idx\` ON \`forms_blocks_country\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_country_path_idx\` ON \`forms_blocks_country\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_country_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_country\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_country_locales_locale_parent_id_unique\` ON \`forms_blocks_country_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_email\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_email_order_idx\` ON \`forms_blocks_email\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_email_parent_id_idx\` ON \`forms_blocks_email\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_email_path_idx\` ON \`forms_blocks_email\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_email_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_email\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_email_locales_locale_parent_id_unique\` ON \`forms_blocks_email_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_message\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_message_order_idx\` ON \`forms_blocks_message\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_message_parent_id_idx\` ON \`forms_blocks_message\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_message_path_idx\` ON \`forms_blocks_message\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_message_locales\` (
  	\`message\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_message\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_message_locales_locale_parent_id_unique\` ON \`forms_blocks_message_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_number\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`default_value\` numeric,
  	\`required\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_number_order_idx\` ON \`forms_blocks_number\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_number_parent_id_idx\` ON \`forms_blocks_number\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_number_path_idx\` ON \`forms_blocks_number\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_number_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_number\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_number_locales_locale_parent_id_unique\` ON \`forms_blocks_number_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_select_options\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`value\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_select\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_select_options_order_idx\` ON \`forms_blocks_select_options\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_select_options_parent_id_idx\` ON \`forms_blocks_select_options\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_select_options_locales\` (
  	\`label\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_select_options\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_select_options_locales_locale_parent_id_unique\` ON \`forms_blocks_select_options_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_select\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`placeholder\` text,
  	\`required\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_select_order_idx\` ON \`forms_blocks_select\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_select_parent_id_idx\` ON \`forms_blocks_select\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_select_path_idx\` ON \`forms_blocks_select\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_select_locales\` (
  	\`label\` text,
  	\`default_value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_select\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_select_locales_locale_parent_id_unique\` ON \`forms_blocks_select_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_state\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_state_order_idx\` ON \`forms_blocks_state\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_state_parent_id_idx\` ON \`forms_blocks_state\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_state_path_idx\` ON \`forms_blocks_state\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_state_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_state\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_state_locales_locale_parent_id_unique\` ON \`forms_blocks_state_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_text_order_idx\` ON \`forms_blocks_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_text_parent_id_idx\` ON \`forms_blocks_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_text_path_idx\` ON \`forms_blocks_text\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_text_locales\` (
  	\`label\` text,
  	\`default_value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_text_locales_locale_parent_id_unique\` ON \`forms_blocks_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_textarea\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_textarea_order_idx\` ON \`forms_blocks_textarea\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_textarea_parent_id_idx\` ON \`forms_blocks_textarea\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_textarea_path_idx\` ON \`forms_blocks_textarea\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_textarea_locales\` (
  	\`label\` text,
  	\`default_value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_textarea\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_textarea_locales_locale_parent_id_unique\` ON \`forms_blocks_textarea_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_emails\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`email_to\` text,
  	\`cc\` text,
  	\`bcc\` text,
  	\`reply_to\` text,
  	\`email_from\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_emails_order_idx\` ON \`forms_emails\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_emails_parent_id_idx\` ON \`forms_emails\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_emails_locales\` (
  	\`subject\` text DEFAULT 'You''ve received a new message.' NOT NULL,
  	\`message\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_emails\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_emails_locales_locale_parent_id_unique\` ON \`forms_emails_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`confirmation_type\` text DEFAULT 'message',
  	\`redirect_type\` text DEFAULT 'reference',
  	\`redirect_url\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_updated_at_idx\` ON \`forms\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`forms_created_at_idx\` ON \`forms\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`forms_locales\` (
  	\`submit_button_label\` text,
  	\`confirmation_message\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_locales_locale_parent_id_unique\` ON \`forms_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`pages_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_rels_order_idx\` ON \`forms_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`forms_rels_parent_idx\` ON \`forms_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_rels_path_idx\` ON \`forms_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`forms_rels_pages_id_idx\` ON \`forms_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE TABLE \`form_submissions_submission_data\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`field\` text NOT NULL,
  	\`value\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`form_submissions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`form_submissions_submission_data_order_idx\` ON \`form_submissions_submission_data\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`form_submissions_submission_data_parent_id_idx\` ON \`form_submissions_submission_data\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`form_submissions\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`form_id\` integer NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`form_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`form_submissions_form_idx\` ON \`form_submissions\` (\`form_id\`);`)
  await db.run(sql`CREATE INDEX \`form_submissions_updated_at_idx\` ON \`form_submissions\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`form_submissions_created_at_idx\` ON \`form_submissions\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`search\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`priority\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`search_updated_at_idx\` ON \`search\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`search_created_at_idx\` ON \`search\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`search_locales\` (
  	\`title\` text,
  	\`slug\` text,
  	\`excerpt\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`search\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`search_locales_locale_parent_id_unique\` ON \`search_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`search_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`products_id\` integer,
  	\`docs_id\` integer,
  	\`faqs_id\` integer,
  	\`posts_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`search\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`docs_id\`) REFERENCES \`docs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`faqs_id\`) REFERENCES \`faqs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`search_rels_order_idx\` ON \`search_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`search_rels_parent_idx\` ON \`search_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`search_rels_path_idx\` ON \`search_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`search_rels_products_id_idx\` ON \`search_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`search_rels_docs_id_idx\` ON \`search_rels\` (\`docs_id\`);`)
  await db.run(sql`CREATE INDEX \`search_rels_faqs_id_idx\` ON \`search_rels\` (\`faqs_id\`);`)
  await db.run(sql`CREATE INDEX \`search_rels_posts_id_idx\` ON \`search_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`global_slug\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
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
  	\`orders_id\` integer,
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
  	FOREIGN KEY (\`orders_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`licenses_id\`) REFERENCES \`licenses\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`forms_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`form_submissions_id\`) REFERENCES \`form_submissions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`search_id\`) REFERENCES \`search\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
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
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_orders_id_idx\` ON \`payload_locked_documents_rels\` (\`orders_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_licenses_id_idx\` ON \`payload_locked_documents_rels\` (\`licenses_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_forms_id_idx\` ON \`payload_locked_documents_rels\` (\`forms_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_form_submissions_id_idx\` ON \`payload_locked_documents_rels\` (\`form_submissions_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_search_id_idx\` ON \`payload_locked_documents_rels\` (\`search_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`value\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
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
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_customers_id_idx\` ON \`payload_preferences_rels\` (\`customers_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`batch\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`header_nav_items_children\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`header_nav_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`header_nav_items_children_order_idx\` ON \`header_nav_items_children\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`header_nav_items_children_parent_id_idx\` ON \`header_nav_items_children\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`header_nav_items_children_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`header_nav_items_children\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`header_nav_items_children_locales_locale_parent_id_unique\` ON \`header_nav_items_children_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`header_nav_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`mega_menu\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`header\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`header_nav_items_order_idx\` ON \`header_nav_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`header_nav_items_parent_id_idx\` ON \`header_nav_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`header_nav_items_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`header_nav_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`header_nav_items_locales_locale_parent_id_unique\` ON \`header_nav_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`header\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`cta_link_type\` text DEFAULT 'internal',
  	\`cta_link_new_tab\` integer,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`CREATE TABLE \`header_locales\` (
  	\`cta_link_url\` text,
  	\`cta_link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`header\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`header_locales_locale_parent_id_unique\` ON \`header_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`header_rels\` (
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
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`header\`(\`id\`) ON UPDATE no action ON DELETE cascade,
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
  await db.run(sql`CREATE INDEX \`header_rels_order_idx\` ON \`header_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`header_rels_parent_idx\` ON \`header_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`header_rels_path_idx\` ON \`header_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`header_rels_pages_id_idx\` ON \`header_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`header_rels_products_id_idx\` ON \`header_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`header_rels_product_families_id_idx\` ON \`header_rels\` (\`product_families_id\`);`)
  await db.run(sql`CREATE INDEX \`header_rels_solutions_id_idx\` ON \`header_rels\` (\`solutions_id\`);`)
  await db.run(sql`CREATE INDEX \`header_rels_industries_id_idx\` ON \`header_rels\` (\`industries_id\`);`)
  await db.run(sql`CREATE INDEX \`header_rels_case_studies_id_idx\` ON \`header_rels\` (\`case_studies_id\`);`)
  await db.run(sql`CREATE INDEX \`header_rels_posts_id_idx\` ON \`header_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`header_rels_careers_id_idx\` ON \`header_rels\` (\`careers_id\`);`)
  await db.run(sql`CREATE INDEX \`header_rels_docs_id_idx\` ON \`header_rels\` (\`docs_id\`);`)
  await db.run(sql`CREATE TABLE \`footer_columns_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer_columns\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`footer_columns_links_order_idx\` ON \`footer_columns_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`footer_columns_links_parent_id_idx\` ON \`footer_columns_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`footer_columns_links_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer_columns_links\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`footer_columns_links_locales_locale_parent_id_unique\` ON \`footer_columns_links_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`footer_columns\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`footer_columns_order_idx\` ON \`footer_columns\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`footer_columns_parent_id_idx\` ON \`footer_columns\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`footer_columns_locales\` (
  	\`title\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer_columns\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`footer_columns_locales_locale_parent_id_unique\` ON \`footer_columns_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`footer_legal_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`footer_legal_links_order_idx\` ON \`footer_legal_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`footer_legal_links_parent_id_idx\` ON \`footer_legal_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`footer_legal_links_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer_legal_links\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`footer_legal_links_locales_locale_parent_id_unique\` ON \`footer_legal_links_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`footer\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`show_newsletter\` integer DEFAULT false,
  	\`newsletter_form_id\` integer,
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`newsletter_form_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`footer_newsletter_form_idx\` ON \`footer\` (\`newsletter_form_id\`);`)
  await db.run(sql`CREATE TABLE \`footer_locales\` (
  	\`copyright\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`footer\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`footer_locales_locale_parent_id_unique\` ON \`footer_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`footer_rels\` (
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
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`footer\`(\`id\`) ON UPDATE no action ON DELETE cascade,
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
  await db.run(sql`CREATE INDEX \`footer_rels_order_idx\` ON \`footer_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`footer_rels_parent_idx\` ON \`footer_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`footer_rels_path_idx\` ON \`footer_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`footer_rels_pages_id_idx\` ON \`footer_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`footer_rels_products_id_idx\` ON \`footer_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`footer_rels_product_families_id_idx\` ON \`footer_rels\` (\`product_families_id\`);`)
  await db.run(sql`CREATE INDEX \`footer_rels_solutions_id_idx\` ON \`footer_rels\` (\`solutions_id\`);`)
  await db.run(sql`CREATE INDEX \`footer_rels_industries_id_idx\` ON \`footer_rels\` (\`industries_id\`);`)
  await db.run(sql`CREATE INDEX \`footer_rels_case_studies_id_idx\` ON \`footer_rels\` (\`case_studies_id\`);`)
  await db.run(sql`CREATE INDEX \`footer_rels_posts_id_idx\` ON \`footer_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`footer_rels_careers_id_idx\` ON \`footer_rels\` (\`careers_id\`);`)
  await db.run(sql`CREATE INDEX \`footer_rels_docs_id_idx\` ON \`footer_rels\` (\`docs_id\`);`)
  await db.run(sql`CREATE TABLE \`site_settings_social\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`platform\` text NOT NULL,
  	\`url\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`site_settings_social_order_idx\` ON \`site_settings_social\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_social_parent_id_idx\` ON \`site_settings_social\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`site_settings\` (
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
  	\`legal_distance_sales_id\` integer,
  	\`legal_pre_information_id\` integer,
  	\`legal_refund_id\` integer,
  	\`legal_terms_id\` integer,
  	\`legal_eula_id\` integer,
  	\`commerce_checkout_enabled\` integer DEFAULT false,
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
  	FOREIGN KEY (\`legal_distance_sales_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`legal_pre_information_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`legal_refund_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`legal_terms_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`legal_eula_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`commerce_quote_form_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`commerce_demo_form_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`site_settings_logo_idx\` ON \`site_settings\` (\`logo_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_logo_dark_idx\` ON \`site_settings\` (\`logo_dark_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_default_og_image_idx\` ON \`site_settings\` (\`default_og_image_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_kvkk_idx\` ON \`site_settings\` (\`legal_kvkk_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_privacy_idx\` ON \`site_settings\` (\`legal_privacy_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_cookies_idx\` ON \`site_settings\` (\`legal_cookies_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_distance_sales_idx\` ON \`site_settings\` (\`legal_distance_sales_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_pre_information_idx\` ON \`site_settings\` (\`legal_pre_information_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_refund_idx\` ON \`site_settings\` (\`legal_refund_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_terms_idx\` ON \`site_settings\` (\`legal_terms_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_legal_legal_eula_idx\` ON \`site_settings\` (\`legal_eula_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_commerce_commerce_quote_form_idx\` ON \`site_settings\` (\`commerce_quote_form_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_commerce_commerce_demo_form_idx\` ON \`site_settings\` (\`commerce_demo_form_id\`);`)
  await db.run(sql`CREATE TABLE \`site_settings_locales\` (
  	\`site_name\` text DEFAULT 'SoftMarket' NOT NULL,
  	\`tagline\` text,
  	\`contact_address\` text,
  	\`contact_working_hours\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`site_settings_locales_locale_parent_id_unique\` ON \`site_settings_locales\` (\`_locale\`,\`_parent_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`users_roles\`;`)
  await db.run(sql`DROP TABLE \`users_sessions\`;`)
  await db.run(sql`DROP TABLE \`users\`;`)
  await db.run(sql`DROP TABLE \`customers_sessions\`;`)
  await db.run(sql`DROP TABLE \`customers\`;`)
  await db.run(sql`DROP TABLE \`product_families\`;`)
  await db.run(sql`DROP TABLE \`product_families_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_hero_actions\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_hero_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_hero\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_hero_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_feature_grid_items\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_feature_grid_items_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_feature_grid\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_feature_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_media_text_actions\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_media_text_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_media_text\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_media_text_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_spec_table_groups_rows\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_spec_table_groups_rows_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_spec_table_groups\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_spec_table_groups_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_spec_table\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_spec_table_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_stats_items\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_stats_items_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_stats\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_stats_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_logo_wall_logos\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_logo_wall\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_logo_wall_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_cta_actions\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_cta_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_cta\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_cta_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_faq_items\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_faq_items_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_faq\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_faq_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_rich_text\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_rich_text_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_video_embed\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_video_embed_locales\`;`)
  await db.run(sql`DROP TABLE \`products_features\`;`)
  await db.run(sql`DROP TABLE \`products_features_locales\`;`)
  await db.run(sql`DROP TABLE \`products_specs\`;`)
  await db.run(sql`DROP TABLE \`products_specs_locales\`;`)
  await db.run(sql`DROP TABLE \`products_system_requirements\`;`)
  await db.run(sql`DROP TABLE \`products_system_requirements_locales\`;`)
  await db.run(sql`DROP TABLE \`products\`;`)
  await db.run(sql`DROP TABLE \`products_locales\`;`)
  await db.run(sql`DROP TABLE \`products_rels\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_hero_actions\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_hero_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_hero\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_hero_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_feature_grid_items\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_feature_grid_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_feature_grid\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_feature_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_media_text_actions\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_media_text_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_media_text\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_media_text_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_spec_table_groups_rows\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_spec_table_groups_rows_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_spec_table_groups\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_spec_table_groups_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_spec_table\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_spec_table_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_stats_items\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_stats_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_stats\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_stats_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_logo_wall_logos\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_logo_wall\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_logo_wall_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_cta_actions\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_cta_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_cta\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_cta_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_faq_items\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_faq_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_faq\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_faq_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_rich_text\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_rich_text_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_video_embed\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_video_embed_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_version_features\`;`)
  await db.run(sql`DROP TABLE \`_products_v_version_features_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_version_specs\`;`)
  await db.run(sql`DROP TABLE \`_products_v_version_specs_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_version_system_requirements\`;`)
  await db.run(sql`DROP TABLE \`_products_v_version_system_requirements_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v\`;`)
  await db.run(sql`DROP TABLE \`_products_v_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_rels\`;`)
  await db.run(sql`DROP TABLE \`editions_highlights\`;`)
  await db.run(sql`DROP TABLE \`editions_highlights_locales\`;`)
  await db.run(sql`DROP TABLE \`editions\`;`)
  await db.run(sql`DROP TABLE \`editions_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_hero_actions\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_hero_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_hero\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_hero_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_feature_grid_items\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_feature_grid_items_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_feature_grid\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_feature_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_media_text_actions\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_media_text_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_media_text\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_media_text_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_spec_table_groups_rows\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_spec_table_groups_rows_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_spec_table_groups\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_spec_table_groups_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_spec_table\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_spec_table_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_stats_items\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_stats_items_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_stats\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_stats_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_logo_wall_logos\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_logo_wall\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_logo_wall_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_cta_actions\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_cta_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_cta\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_cta_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_faq_items\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_faq_items_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_faq\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_faq_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_rich_text\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_rich_text_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_video_embed\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_video_embed_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions\`;`)
  await db.run(sql`DROP TABLE \`solutions_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_rels\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_hero_actions\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_hero_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_hero\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_hero_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_feature_grid_items\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_feature_grid_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_feature_grid\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_feature_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_media_text_actions\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_media_text_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_media_text\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_media_text_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_spec_table_groups_rows\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_spec_table_groups_rows_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_spec_table_groups\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_spec_table_groups_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_spec_table\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_spec_table_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_stats_items\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_stats_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_stats\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_stats_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_logo_wall_logos\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_logo_wall\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_logo_wall_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_cta_actions\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_cta_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_cta\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_cta_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_faq_items\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_faq_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_faq\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_faq_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_rich_text\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_rich_text_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_video_embed\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_video_embed_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_rels\`;`)
  await db.run(sql`DROP TABLE \`industries\`;`)
  await db.run(sql`DROP TABLE \`industries_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_results\`;`)
  await db.run(sql`DROP TABLE \`case_studies_results_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_hero_actions\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_hero_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_hero\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_hero_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_feature_grid_items\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_feature_grid_items_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_feature_grid\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_feature_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_media_text_actions\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_media_text_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_media_text\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_media_text_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_spec_table_groups_rows\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_spec_table_groups_rows_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_spec_table_groups\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_spec_table_groups_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_spec_table\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_spec_table_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_stats_items\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_stats_items_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_stats\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_stats_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_logo_wall_logos\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_logo_wall\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_logo_wall_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_cta_actions\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_cta_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_cta\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_cta_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_faq_items\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_faq_items_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_faq\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_faq_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_rich_text\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_rich_text_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_video_embed\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_video_embed_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies\`;`)
  await db.run(sql`DROP TABLE \`case_studies_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_rels\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_version_results\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_version_results_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_hero_actions\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_hero_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_hero\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_hero_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_feature_grid_items\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_feature_grid_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_feature_grid\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_feature_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_media_text_actions\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_media_text_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_media_text\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_media_text_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_spec_table_groups_rows\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_spec_table_groups_rows_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_spec_table_groups\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_spec_table_groups_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_spec_table\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_spec_table_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_stats_items\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_stats_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_stats\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_stats_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_logo_wall_logos\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_logo_wall\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_logo_wall_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_cta_actions\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_cta_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_cta\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_cta_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_faq_items\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_faq_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_faq\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_faq_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_rich_text\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_rich_text_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_video_embed\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_video_embed_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_rels\`;`)
  await db.run(sql`DROP TABLE \`posts\`;`)
  await db.run(sql`DROP TABLE \`posts_locales\`;`)
  await db.run(sql`DROP TABLE \`posts_rels\`;`)
  await db.run(sql`DROP TABLE \`_posts_v\`;`)
  await db.run(sql`DROP TABLE \`_posts_v_locales\`;`)
  await db.run(sql`DROP TABLE \`_posts_v_rels\`;`)
  await db.run(sql`DROP TABLE \`careers\`;`)
  await db.run(sql`DROP TABLE \`careers_locales\`;`)
  await db.run(sql`DROP TABLE \`partners\`;`)
  await db.run(sql`DROP TABLE \`partners_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_hero_actions\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_hero_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_hero\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_hero_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_feature_grid_items\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_feature_grid_items_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_feature_grid\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_feature_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_media_text_actions\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_media_text_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_media_text\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_media_text_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_spec_table_groups_rows\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_spec_table_groups_rows_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_spec_table_groups\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_spec_table_groups_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_spec_table\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_spec_table_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_stats_items\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_stats_items_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_stats\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_stats_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_logo_wall_logos\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_logo_wall\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_logo_wall_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_cta_actions\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_cta_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_cta\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_cta_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_faq_items\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_faq_items_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_faq\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_faq_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_rich_text\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_rich_text_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_video_embed\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_video_embed_locales\`;`)
  await db.run(sql`DROP TABLE \`pages\`;`)
  await db.run(sql`DROP TABLE \`pages_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_rels\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_hero_actions\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_hero_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_hero\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_hero_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_feature_grid_items\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_feature_grid_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_feature_grid\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_feature_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_media_text_actions\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_media_text_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_media_text\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_media_text_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_spec_table_groups_rows\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_spec_table_groups_rows_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_spec_table_groups\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_spec_table_groups_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_spec_table\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_spec_table_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_stats_items\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_stats_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_stats\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_stats_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_logo_wall_logos\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_logo_wall\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_logo_wall_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_cta_actions\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_cta_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_cta\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_cta_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_faq_items\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_faq_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_faq\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_faq_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_rich_text\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_rich_text_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_video_embed\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_video_embed_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_rels\`;`)
  await db.run(sql`DROP TABLE \`media\`;`)
  await db.run(sql`DROP TABLE \`media_locales\`;`)
  await db.run(sql`DROP TABLE \`media_rels\`;`)
  await db.run(sql`DROP TABLE \`docs\`;`)
  await db.run(sql`DROP TABLE \`docs_locales\`;`)
  await db.run(sql`DROP TABLE \`_docs_v\`;`)
  await db.run(sql`DROP TABLE \`_docs_v_locales\`;`)
  await db.run(sql`DROP TABLE \`releases_changes\`;`)
  await db.run(sql`DROP TABLE \`releases_changes_locales\`;`)
  await db.run(sql`DROP TABLE \`releases\`;`)
  await db.run(sql`DROP TABLE \`releases_locales\`;`)
  await db.run(sql`DROP TABLE \`downloads\`;`)
  await db.run(sql`DROP TABLE \`downloads_locales\`;`)
  await db.run(sql`DROP TABLE \`faqs\`;`)
  await db.run(sql`DROP TABLE \`faqs_locales\`;`)
  await db.run(sql`DROP TABLE \`support_tickets\`;`)
  await db.run(sql`DROP TABLE \`support_ticket_messages\`;`)
  await db.run(sql`DROP TABLE \`orders_items\`;`)
  await db.run(sql`DROP TABLE \`orders_webhook_events\`;`)
  await db.run(sql`DROP TABLE \`orders\`;`)
  await db.run(sql`DROP TABLE \`licenses\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_checkbox\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_checkbox_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_country\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_country_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_email\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_email_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_message\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_message_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_number\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_number_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_select_options\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_select_options_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_select\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_select_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_state\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_state_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_text\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_text_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_textarea\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_textarea_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_emails\`;`)
  await db.run(sql`DROP TABLE \`forms_emails_locales\`;`)
  await db.run(sql`DROP TABLE \`forms\`;`)
  await db.run(sql`DROP TABLE \`forms_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_rels\`;`)
  await db.run(sql`DROP TABLE \`form_submissions_submission_data\`;`)
  await db.run(sql`DROP TABLE \`form_submissions\`;`)
  await db.run(sql`DROP TABLE \`search\`;`)
  await db.run(sql`DROP TABLE \`search_locales\`;`)
  await db.run(sql`DROP TABLE \`search_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
  await db.run(sql`DROP TABLE \`header_nav_items_children\`;`)
  await db.run(sql`DROP TABLE \`header_nav_items_children_locales\`;`)
  await db.run(sql`DROP TABLE \`header_nav_items\`;`)
  await db.run(sql`DROP TABLE \`header_nav_items_locales\`;`)
  await db.run(sql`DROP TABLE \`header\`;`)
  await db.run(sql`DROP TABLE \`header_locales\`;`)
  await db.run(sql`DROP TABLE \`header_rels\`;`)
  await db.run(sql`DROP TABLE \`footer_columns_links\`;`)
  await db.run(sql`DROP TABLE \`footer_columns_links_locales\`;`)
  await db.run(sql`DROP TABLE \`footer_columns\`;`)
  await db.run(sql`DROP TABLE \`footer_columns_locales\`;`)
  await db.run(sql`DROP TABLE \`footer_legal_links\`;`)
  await db.run(sql`DROP TABLE \`footer_legal_links_locales\`;`)
  await db.run(sql`DROP TABLE \`footer\`;`)
  await db.run(sql`DROP TABLE \`footer_locales\`;`)
  await db.run(sql`DROP TABLE \`footer_rels\`;`)
  await db.run(sql`DROP TABLE \`site_settings_social\`;`)
  await db.run(sql`DROP TABLE \`site_settings\`;`)
  await db.run(sql`DROP TABLE \`site_settings_locales\`;`)
}
