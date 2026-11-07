import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`product_families_blocks_hero_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_route\` text,
  	\`link_route_param\` text,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_hero_actions_order_idx\` ON \`product_families_blocks_hero_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_hero_actions_parent_id_idx\` ON \`product_families_blocks_hero_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_hero_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_hero_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_hero_actions_locales_locale_parent_i\` ON \`product_families_blocks_hero_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_hero\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`variant\` text DEFAULT 'default',
  	\`media_id\` integer,
  	\`aside\` text DEFAULT 'media',
  	\`video_id\` integer,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'lg',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`video_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_hero_order_idx\` ON \`product_families_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_hero_parent_id_idx\` ON \`product_families_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_hero_path_idx\` ON \`product_families_blocks_hero\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_hero_media_idx\` ON \`product_families_blocks_hero\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_hero_video_idx\` ON \`product_families_blocks_hero\` (\`video_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_hero_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text NOT NULL,
  	\`subheading\` text,
  	\`panel_title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_hero\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_hero_locales_locale_parent_id_unique\` ON \`product_families_blocks_hero_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_feature_grid_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`icon\` text,
  	\`image_id\` integer,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_feature_grid_items_order_idx\` ON \`product_families_blocks_feature_grid_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_feature_grid_items_parent_id_idx\` ON \`product_families_blocks_feature_grid_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_feature_grid_items_image_idx\` ON \`product_families_blocks_feature_grid_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_feature_grid_items_locales\` (
  	\`title\` text NOT NULL,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_feature_grid_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_feature_grid_items_locales_locale_pa\` ON \`product_families_blocks_feature_grid_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_feature_grid\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`columns\` text DEFAULT '3',
  	\`style\` text DEFAULT 'cards',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_feature_grid_order_idx\` ON \`product_families_blocks_feature_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_feature_grid_parent_id_idx\` ON \`product_families_blocks_feature_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_feature_grid_path_idx\` ON \`product_families_blocks_feature_grid\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_feature_grid_locales\` (
  	\`heading\` text,
  	\`intro\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_feature_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_feature_grid_locales_locale_parent_i\` ON \`product_families_blocks_feature_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_media_text_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_route\` text,
  	\`link_route_param\` text,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_media_text_actions_order_idx\` ON \`product_families_blocks_media_text_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_media_text_actions_parent_id_idx\` ON \`product_families_blocks_media_text_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_media_text_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_media_text_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_media_text_actions_locales_locale_pa\` ON \`product_families_blocks_media_text_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_media_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`media_id\` integer NOT NULL,
  	\`media_position\` text DEFAULT 'left',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_media_text_order_idx\` ON \`product_families_blocks_media_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_media_text_parent_id_idx\` ON \`product_families_blocks_media_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_media_text_path_idx\` ON \`product_families_blocks_media_text\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_media_text_media_idx\` ON \`product_families_blocks_media_text\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_media_text_locales\` (
  	\`heading\` text,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_media_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_media_text_locales_locale_parent_id_\` ON \`product_families_blocks_media_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_spec_table_groups_rows\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_spec_table_groups_rows_order_idx\` ON \`product_families_blocks_spec_table_groups_rows\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_spec_table_groups_rows_parent_id_idx\` ON \`product_families_blocks_spec_table_groups_rows\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_spec_table_groups_rows_locales\` (
  	\`label\` text NOT NULL,
  	\`value\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_spec_table_groups_rows\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_spec_table_groups_rows_locales_local\` ON \`product_families_blocks_spec_table_groups_rows_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_spec_table_groups\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_spec_table_groups_order_idx\` ON \`product_families_blocks_spec_table_groups\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_spec_table_groups_parent_id_idx\` ON \`product_families_blocks_spec_table_groups\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_spec_table_groups_locales\` (
  	\`title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_spec_table_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_spec_table_groups_locales_locale_par\` ON \`product_families_blocks_spec_table_groups_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_spec_table\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_spec_table_order_idx\` ON \`product_families_blocks_spec_table\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_spec_table_parent_id_idx\` ON \`product_families_blocks_spec_table\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_spec_table_path_idx\` ON \`product_families_blocks_spec_table\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_spec_table_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_spec_table\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_spec_table_locales_locale_parent_id_\` ON \`product_families_blocks_spec_table_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_stats_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`value\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_stats_items_order_idx\` ON \`product_families_blocks_stats_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_stats_items_parent_id_idx\` ON \`product_families_blocks_stats_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_stats_items_locales\` (
  	\`label\` text NOT NULL,
  	\`description\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_stats_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_stats_items_locales_locale_parent_id\` ON \`product_families_blocks_stats_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_stats\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_stats_order_idx\` ON \`product_families_blocks_stats\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_stats_parent_id_idx\` ON \`product_families_blocks_stats\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_stats_path_idx\` ON \`product_families_blocks_stats\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_stats_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_stats\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_stats_locales_locale_parent_id_uniqu\` ON \`product_families_blocks_stats_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_logo_wall_logos\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`logo_id\` integer,
  	\`name\` text,
  	\`url\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_logo_wall_logos_order_idx\` ON \`product_families_blocks_logo_wall_logos\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_logo_wall_logos_parent_id_idx\` ON \`product_families_blocks_logo_wall_logos\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_logo_wall_logos_logo_idx\` ON \`product_families_blocks_logo_wall_logos\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_logo_wall\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'manual',
  	\`limit\` numeric DEFAULT 12,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'center',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_logo_wall_order_idx\` ON \`product_families_blocks_logo_wall\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_logo_wall_parent_id_idx\` ON \`product_families_blocks_logo_wall\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_logo_wall_path_idx\` ON \`product_families_blocks_logo_wall\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_logo_wall_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_logo_wall\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_logo_wall_locales_locale_parent_id_u\` ON \`product_families_blocks_logo_wall_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_cta_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_route\` text,
  	\`link_route_param\` text,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_cta_actions_order_idx\` ON \`product_families_blocks_cta_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_cta_actions_parent_id_idx\` ON \`product_families_blocks_cta_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_cta_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_cta_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_cta_actions_locales_locale_parent_id\` ON \`product_families_blocks_cta_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_cta\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`style\` text DEFAULT 'banner',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'center',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_cta_order_idx\` ON \`product_families_blocks_cta\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_cta_parent_id_idx\` ON \`product_families_blocks_cta\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_cta_path_idx\` ON \`product_families_blocks_cta\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_cta_locales\` (
  	\`heading\` text NOT NULL,
  	\`body\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_cta\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_cta_locales_locale_parent_id_unique\` ON \`product_families_blocks_cta_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_faq_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_faq_items_order_idx\` ON \`product_families_blocks_faq_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_faq_items_parent_id_idx\` ON \`product_families_blocks_faq_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_faq_items_locales\` (
  	\`question\` text,
  	\`answer\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_faq_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_faq_items_locales_locale_parent_id_u\` ON \`product_families_blocks_faq_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_faq\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'collection',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_faq_order_idx\` ON \`product_families_blocks_faq\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_faq_parent_id_idx\` ON \`product_families_blocks_faq\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_faq_path_idx\` ON \`product_families_blocks_faq\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_faq_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_faq\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_faq_locales_locale_parent_id_unique\` ON \`product_families_blocks_faq_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_rich_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`width\` text DEFAULT 'normal',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_rich_text_order_idx\` ON \`product_families_blocks_rich_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_rich_text_parent_id_idx\` ON \`product_families_blocks_rich_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_rich_text_path_idx\` ON \`product_families_blocks_rich_text\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_rich_text_locales\` (
  	\`content\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_rich_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_rich_text_locales_locale_parent_id_u\` ON \`product_families_blocks_rich_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_video_embed\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`poster_id\` integer,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`poster_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_video_embed_order_idx\` ON \`product_families_blocks_video_embed\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_video_embed_parent_id_idx\` ON \`product_families_blocks_video_embed\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_video_embed_path_idx\` ON \`product_families_blocks_video_embed\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_video_embed_poster_idx\` ON \`product_families_blocks_video_embed\` (\`poster_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_video_embed_locales\` (
  	\`heading\` text,
  	\`url\` text NOT NULL,
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_video_embed\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_video_embed_locales_locale_parent_id\` ON \`product_families_blocks_video_embed_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_media_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer NOT NULL,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_media_items_order_idx\` ON \`product_families_blocks_media_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_media_items_parent_id_idx\` ON \`product_families_blocks_media_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_media_items_image_idx\` ON \`product_families_blocks_media_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_media_items_locales\` (
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_media_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_media_items_locales_locale_parent_id\` ON \`product_families_blocks_media_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_media\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`aspect\` text DEFAULT 'auto',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_media_order_idx\` ON \`product_families_blocks_media\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_media_parent_id_idx\` ON \`product_families_blocks_media\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_media_path_idx\` ON \`product_families_blocks_media\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_media_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_media_locales_locale_parent_id_uniqu\` ON \`product_families_blocks_media_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_testimonial\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`company\` text,
  	\`photo_id\` integer,
  	\`logo_id\` integer,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'center',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_testimonial_order_idx\` ON \`product_families_blocks_testimonial\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_testimonial_parent_id_idx\` ON \`product_families_blocks_testimonial\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_testimonial_path_idx\` ON \`product_families_blocks_testimonial\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_testimonial_photo_idx\` ON \`product_families_blocks_testimonial\` (\`photo_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_testimonial_logo_idx\` ON \`product_families_blocks_testimonial\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_testimonial_locales\` (
  	\`quote\` text NOT NULL,
  	\`role\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_testimonial\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_testimonial_locales_locale_parent_id\` ON \`product_families_blocks_testimonial_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_tabs_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_tabs_items_order_idx\` ON \`product_families_blocks_tabs_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_tabs_items_parent_id_idx\` ON \`product_families_blocks_tabs_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_tabs_items_media_idx\` ON \`product_families_blocks_tabs_items\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_tabs_items_locales\` (
  	\`label\` text NOT NULL,
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_tabs_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_tabs_items_locales_locale_parent_id_\` ON \`product_families_blocks_tabs_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_tabs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_tabs_order_idx\` ON \`product_families_blocks_tabs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_tabs_parent_id_idx\` ON \`product_families_blocks_tabs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_tabs_path_idx\` ON \`product_families_blocks_tabs\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_tabs_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_tabs_locales_locale_parent_id_unique\` ON \`product_families_blocks_tabs_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_spacer\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`size\` text DEFAULT 'md',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'none',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_spacer_order_idx\` ON \`product_families_blocks_spacer\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_spacer_parent_id_idx\` ON \`product_families_blocks_spacer\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_spacer_path_idx\` ON \`product_families_blocks_spacer\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_divider\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`style\` text DEFAULT 'line',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'sm',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_divider_order_idx\` ON \`product_families_blocks_divider\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_divider_parent_id_idx\` ON \`product_families_blocks_divider\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_divider_path_idx\` ON \`product_families_blocks_divider\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_product_families\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'all',
  	\`show_count\` integer DEFAULT true,
  	\`limit\` numeric DEFAULT 6,
  	\`sort\` text DEFAULT 'order',
  	\`layout\` text DEFAULT 'grid-3',
  	\`show_view_all\` integer DEFAULT true,
  	\`view_all_url\` text,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'lg',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_product_families_order_idx\` ON \`product_families_blocks_product_families\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_product_families_parent_id_idx\` ON \`product_families_blocks_product_families\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_product_families_path_idx\` ON \`product_families_blocks_product_families\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_product_families_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_product_families_locales_locale_pare\` ON \`product_families_blocks_product_families_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_product_showcase\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'featured',
  	\`family_id\` integer,
  	\`industry_id\` integer,
  	\`limit\` numeric DEFAULT 6,
  	\`sort\` text DEFAULT 'order',
  	\`layout\` text DEFAULT 'grid-3',
  	\`show_view_all\` integer DEFAULT true,
  	\`view_all_url\` text,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'lg',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`family_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_product_showcase_order_idx\` ON \`product_families_blocks_product_showcase\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_product_showcase_parent_id_idx\` ON \`product_families_blocks_product_showcase\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_product_showcase_path_idx\` ON \`product_families_blocks_product_showcase\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_product_showcase_family_idx\` ON \`product_families_blocks_product_showcase\` (\`family_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_product_showcase_industry_idx\` ON \`product_families_blocks_product_showcase\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_product_showcase_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_product_showcase\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_product_showcase_locales_locale_pare\` ON \`product_families_blocks_product_showcase_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_solutions_grid\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'all',
  	\`industry_id\` integer,
  	\`limit\` numeric DEFAULT 4,
  	\`sort\` text DEFAULT 'order',
  	\`layout\` text DEFAULT 'grid-4',
  	\`show_view_all\` integer DEFAULT true,
  	\`view_all_url\` text,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'lg',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_solutions_grid_order_idx\` ON \`product_families_blocks_solutions_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_solutions_grid_parent_id_idx\` ON \`product_families_blocks_solutions_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_solutions_grid_path_idx\` ON \`product_families_blocks_solutions_grid\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_solutions_grid_industry_idx\` ON \`product_families_blocks_solutions_grid\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_solutions_grid_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_solutions_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_solutions_grid_locales_locale_parent\` ON \`product_families_blocks_solutions_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_case_study\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'featured',
  	\`case_study_id\` integer,
  	\`industry_id\` integer,
  	\`show_results\` integer DEFAULT true,
  	\`show_link\` integer DEFAULT true,
  	\`link_url\` text,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'lg',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`case_study_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_case_study_order_idx\` ON \`product_families_blocks_case_study\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_case_study_parent_id_idx\` ON \`product_families_blocks_case_study\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_case_study_path_idx\` ON \`product_families_blocks_case_study\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_case_study_case_study_idx\` ON \`product_families_blocks_case_study\` (\`case_study_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_case_study_industry_idx\` ON \`product_families_blocks_case_study\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_case_study_locales\` (
  	\`eyebrow\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_case_study_locales_locale_parent_id_\` ON \`product_families_blocks_case_study_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_news_list\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`source\` text DEFAULT 'latest',
  	\`category\` text DEFAULT 'news',
  	\`limit\` numeric DEFAULT 3,
  	\`sort\` text DEFAULT 'newest',
  	\`layout\` text DEFAULT 'grid-3',
  	\`show_view_all\` integer DEFAULT true,
  	\`view_all_url\` text,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'lg',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`product_families_blocks_news_list_order_idx\` ON \`product_families_blocks_news_list\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_news_list_parent_id_idx\` ON \`product_families_blocks_news_list\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_blocks_news_list_path_idx\` ON \`product_families_blocks_news_list\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`product_families_blocks_news_list_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`product_families_blocks_news_list\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`product_families_blocks_news_list_locales_locale_parent_id_u\` ON \`product_families_blocks_news_list_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`product_families_rels\` (
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
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade,
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
  await db.run(sql`CREATE INDEX \`product_families_rels_order_idx\` ON \`product_families_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`product_families_rels_parent_idx\` ON \`product_families_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_rels_path_idx\` ON \`product_families_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`product_families_rels_pages_id_idx\` ON \`product_families_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_rels_products_id_idx\` ON \`product_families_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_rels_product_families_id_idx\` ON \`product_families_rels\` (\`product_families_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_rels_solutions_id_idx\` ON \`product_families_rels\` (\`solutions_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_rels_industries_id_idx\` ON \`product_families_rels\` (\`industries_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_rels_case_studies_id_idx\` ON \`product_families_rels\` (\`case_studies_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_rels_posts_id_idx\` ON \`product_families_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_rels_careers_id_idx\` ON \`product_families_rels\` (\`careers_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_rels_docs_id_idx\` ON \`product_families_rels\` (\`docs_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_rels_partners_id_idx\` ON \`product_families_rels\` (\`partners_id\`);`)
  await db.run(sql`CREATE INDEX \`product_families_rels_faqs_id_idx\` ON \`product_families_rels\` (\`faqs_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_hero_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_route\` text,
  	\`link_route_param\` text,
  	\`link_appearance\` text DEFAULT 'primary',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_hero_actions_order_idx\` ON \`pages_hero_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_hero_actions_parent_id_idx\` ON \`pages_hero_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_hero_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_hero_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_hero_actions_locales_locale_parent_id_unique\` ON \`pages_hero_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_listing\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_listing_order_idx\` ON \`pages_blocks_listing\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_listing_parent_id_idx\` ON \`pages_blocks_listing\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_listing_path_idx\` ON \`pages_blocks_listing\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_version_hero_actions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`link_type\` text DEFAULT 'internal',
  	\`link_new_tab\` integer,
  	\`link_route\` text,
  	\`link_route_param\` text,
  	\`link_appearance\` text DEFAULT 'primary',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_version_hero_actions_order_idx\` ON \`_pages_v_version_hero_actions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_hero_actions_parent_id_idx\` ON \`_pages_v_version_hero_actions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_version_hero_actions_locales\` (
  	\`link_url\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_version_hero_actions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_version_hero_actions_locales_locale_parent_id_uniqu\` ON \`_pages_v_version_hero_actions_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_listing\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_listing_order_idx\` ON \`_pages_v_blocks_listing\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_listing_parent_id_idx\` ON \`_pages_v_blocks_listing\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_listing_path_idx\` ON \`_pages_v_blocks_listing\` (\`_path\`);`)
  await db.run(sql`ALTER TABLE \`products_blocks_hero\` ADD \`aside\` text DEFAULT 'media';`)
  await db.run(sql`ALTER TABLE \`products_blocks_hero\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_hero_locales\` ADD \`panel_title\` text;`)
  await db.run(sql`ALTER TABLE \`products_blocks_feature_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_media_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_spec_table\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_stats\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_logo_wall\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_cta\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_faq\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_rich_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_video_embed\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_media\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_testimonial\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_tabs\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_spacer\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_divider\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_product_families\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_product_showcase\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_solutions_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_case_study\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`products_blocks_news_list\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_hero\` ADD \`aside\` text DEFAULT 'media';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_hero\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_hero_locales\` ADD \`panel_title\` text;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_feature_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_media_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_spec_table\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_stats\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_logo_wall\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_cta\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_faq\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_rich_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_video_embed\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_media\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_testimonial\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_tabs\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_spacer\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_divider\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_product_families\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_product_showcase\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_solutions_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_case_study\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_news_list\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_hero\` ADD \`aside\` text DEFAULT 'media';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_hero\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_hero_locales\` ADD \`panel_title\` text;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_feature_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_media_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_spec_table\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_stats\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_logo_wall\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_cta\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_faq\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_rich_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_video_embed\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_media\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_testimonial\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_tabs\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_spacer\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_divider\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_product_families\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_product_showcase\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_solutions_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_case_study\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_news_list\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_hero\` ADD \`aside\` text DEFAULT 'media';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_hero\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_hero_locales\` ADD \`panel_title\` text;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_feature_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_media_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_spec_table\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_stats\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_logo_wall\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_cta\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_faq\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_rich_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_video_embed\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_media\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_testimonial\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_tabs\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_spacer\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_divider\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_product_families\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_product_showcase\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_solutions_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_case_study\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_news_list\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_hero\` ADD \`aside\` text DEFAULT 'media';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_hero\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_hero_locales\` ADD \`panel_title\` text;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_feature_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_media_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_spec_table\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_stats\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_logo_wall\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_cta\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_faq\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_rich_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_video_embed\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_media\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_testimonial\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_tabs\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_spacer\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_divider\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_product_families\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_product_showcase\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_solutions_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_case_study\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_news_list\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_hero\` ADD \`aside\` text DEFAULT 'media';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_hero\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_hero_locales\` ADD \`panel_title\` text;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_feature_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_media_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_spec_table\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_stats\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_logo_wall\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_cta\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_faq\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_rich_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_video_embed\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_media\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_testimonial\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_tabs\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_spacer\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_divider\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_product_families\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_product_showcase\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_solutions_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_case_study\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_news_list\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_hero\` ADD \`aside\` text DEFAULT 'media';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_hero\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_hero_locales\` ADD \`panel_title\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_feature_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_media_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_spec_table\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_stats\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_logo_wall\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_cta\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_faq\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_rich_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_video_embed\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_media\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_testimonial\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_tabs\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_spacer\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_divider\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_product_families\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_product_showcase\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_solutions_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_case_study\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages_blocks_news_list\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`pages\` ADD \`system_key\` text;`)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_system_key_idx\` ON \`pages\` (\`system_key\`);`)
  await db.run(sql`ALTER TABLE \`pages_locales\` ADD \`hero_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`pages_locales\` ADD \`hero_title\` text;`)
  await db.run(sql`ALTER TABLE \`pages_locales\` ADD \`hero_lead\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_hero\` ADD \`aside\` text DEFAULT 'media';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_hero\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_hero_locales\` ADD \`panel_title\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_feature_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_media_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_spec_table\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_stats\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_logo_wall\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_cta\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_faq\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_rich_text\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_video_embed\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_media\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_testimonial\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_tabs\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_spacer\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_divider\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_product_families\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_product_showcase\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_solutions_grid\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_case_study\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_news_list\` ADD \`appearance_separator\` text DEFAULT 'none';`)
  await db.run(sql`ALTER TABLE \`_pages_v\` ADD \`version_system_key\` text;`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_system_key_idx\` ON \`_pages_v\` (\`version_system_key\`);`)
  await db.run(sql`ALTER TABLE \`_pages_v_locales\` ADD \`version_hero_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_locales\` ADD \`version_hero_title\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_locales\` ADD \`version_hero_lead\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`home_page_id\` integer REFERENCES pages(id);`)
  await db.run(sql`CREATE INDEX \`site_settings_home_page_idx\` ON \`site_settings\` (\`home_page_id\`);`)
  // ALTER ADD cannot carry ON DELETE SET NULL here (cf. hero_video_delete): deleting the referenced page
  // would otherwise fail on the foreign key. Clear the reference instead (no table rebuild).
  await db.run(sql.raw('CREATE TRIGGER site_settings_home_page_delete BEFORE DELETE ON pages BEGIN UPDATE "site_settings" SET home_page_id = NULL WHERE home_page_id = OLD.id; END;'))
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Only drops what up() created/added (trigger, tables, indexes, columns); no table is rebuilt.
  await db.run(sql`DROP TRIGGER site_settings_home_page_delete;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_hero_actions\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_hero_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_hero\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_hero_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_feature_grid_items\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_feature_grid_items_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_feature_grid\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_feature_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_media_text_actions\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_media_text_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_media_text\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_media_text_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_spec_table_groups_rows\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_spec_table_groups_rows_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_spec_table_groups\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_spec_table_groups_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_spec_table\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_spec_table_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_stats_items\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_stats_items_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_stats\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_stats_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_logo_wall_logos\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_logo_wall\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_logo_wall_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_cta_actions\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_cta_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_cta\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_cta_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_faq_items\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_faq_items_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_faq\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_faq_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_rich_text\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_rich_text_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_video_embed\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_video_embed_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_media_items\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_media_items_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_media\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_media_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_testimonial\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_testimonial_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_tabs_items\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_tabs_items_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_tabs\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_tabs_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_spacer\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_divider\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_product_families\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_product_families_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_product_showcase\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_product_showcase_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_solutions_grid\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_solutions_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_case_study\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_case_study_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_news_list\`;`)
  await db.run(sql`DROP TABLE \`product_families_blocks_news_list_locales\`;`)
  await db.run(sql`DROP TABLE \`product_families_rels\`;`)
  await db.run(sql`DROP TABLE \`pages_hero_actions\`;`)
  await db.run(sql`DROP TABLE \`pages_hero_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_listing\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_version_hero_actions\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_version_hero_actions_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_listing\`;`)
  // Hand-written (as in F7): the generated down rebuilt site_settings via a __new_ table. Inside the
  // migration transaction PRAGMA foreign_keys=OFF is ignored, so DROP TABLE site_settings would cascade
  // into site_settings_locales/social rows. Drop only the column up() added.
  await db.run(sql`DROP INDEX \`site_settings_home_page_idx\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`home_page_id\`;`)
  await db.run(sql`DROP INDEX \`pages_system_key_idx\`;`)
  await db.run(sql`ALTER TABLE \`pages\` DROP COLUMN \`system_key\`;`)
  await db.run(sql`DROP INDEX \`_pages_v_version_version_system_key_idx\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v\` DROP COLUMN \`version_system_key\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_hero\` DROP COLUMN \`aside\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_hero\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_hero_locales\` DROP COLUMN \`panel_title\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_feature_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_media_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_spec_table\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_stats\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_logo_wall\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_cta\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_faq\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_rich_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_video_embed\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_media\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_testimonial\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_tabs\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_spacer\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_divider\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_product_families\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_product_showcase\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_solutions_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_case_study\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_news_list\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_hero\` DROP COLUMN \`aside\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_hero\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_hero_locales\` DROP COLUMN \`panel_title\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_feature_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_media_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_spec_table\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_stats\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_logo_wall\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_cta\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_faq\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_rich_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_video_embed\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_media\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_testimonial\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_tabs\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_spacer\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_divider\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_product_families\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_product_showcase\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_solutions_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_case_study\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_news_list\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_hero\` DROP COLUMN \`aside\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_hero\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_hero_locales\` DROP COLUMN \`panel_title\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_feature_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_media_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_spec_table\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_stats\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_logo_wall\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_cta\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_faq\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_rich_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_video_embed\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_media\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_testimonial\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_tabs\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_spacer\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_divider\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_product_families\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_product_showcase\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_solutions_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_case_study\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_news_list\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_hero\` DROP COLUMN \`aside\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_hero\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_hero_locales\` DROP COLUMN \`panel_title\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_feature_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_media_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_spec_table\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_stats\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_logo_wall\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_cta\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_faq\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_rich_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_video_embed\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_media\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_testimonial\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_tabs\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_spacer\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_divider\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_product_families\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_product_showcase\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_solutions_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_case_study\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_news_list\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_hero\` DROP COLUMN \`aside\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_hero\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_hero_locales\` DROP COLUMN \`panel_title\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_feature_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_media_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_spec_table\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_stats\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_logo_wall\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_cta\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_faq\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_rich_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_video_embed\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_media\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_testimonial\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_tabs\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_spacer\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_divider\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_product_families\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_product_showcase\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_solutions_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_case_study\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_news_list\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_hero\` DROP COLUMN \`aside\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_hero\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_hero_locales\` DROP COLUMN \`panel_title\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_feature_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_media_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_spec_table\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_stats\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_logo_wall\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_cta\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_faq\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_rich_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_video_embed\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_media\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_testimonial\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_tabs\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_spacer\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_divider\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_product_families\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_product_showcase\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_solutions_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_case_study\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_news_list\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_hero\` DROP COLUMN \`aside\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_hero\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_hero_locales\` DROP COLUMN \`panel_title\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_feature_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_media_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_spec_table\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_stats\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_logo_wall\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_cta\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_faq\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_rich_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_video_embed\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_media\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_testimonial\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_tabs\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_spacer\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_divider\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_product_families\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_product_showcase\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_solutions_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_case_study\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_news_list\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`pages_locales\` DROP COLUMN \`hero_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`pages_locales\` DROP COLUMN \`hero_title\`;`)
  await db.run(sql`ALTER TABLE \`pages_locales\` DROP COLUMN \`hero_lead\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_hero\` DROP COLUMN \`aside\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_hero\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_hero_locales\` DROP COLUMN \`panel_title\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_feature_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_media_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_spec_table\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_stats\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_logo_wall\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_cta\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_faq\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_rich_text\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_video_embed\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_media\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_testimonial\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_tabs\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_spacer\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_divider\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_product_families\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_product_showcase\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_solutions_grid\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_case_study\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_news_list\` DROP COLUMN \`appearance_separator\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_locales\` DROP COLUMN \`version_hero_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_locales\` DROP COLUMN \`version_hero_title\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_locales\` DROP COLUMN \`version_hero_lead\`;`)
}
