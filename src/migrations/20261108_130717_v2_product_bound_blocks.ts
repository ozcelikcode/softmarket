import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`products_blocks_product_hero\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'none',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_product_hero_order_idx\` ON \`products_blocks_product_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_hero_parent_id_idx\` ON \`products_blocks_product_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_hero_path_idx\` ON \`products_blocks_product_hero\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_product_nav\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'none',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_hidden\` integer DEFAULT false,
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_product_nav_order_idx\` ON \`products_blocks_product_nav\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_nav_parent_id_idx\` ON \`products_blocks_product_nav\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_nav_path_idx\` ON \`products_blocks_product_nav\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_product_overview\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_hidden\` integer DEFAULT false,
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_product_overview_order_idx\` ON \`products_blocks_product_overview\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_overview_parent_id_idx\` ON \`products_blocks_product_overview\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_overview_path_idx\` ON \`products_blocks_product_overview\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_product_features\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_hidden\` integer DEFAULT false,
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_product_features_order_idx\` ON \`products_blocks_product_features\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_features_parent_id_idx\` ON \`products_blocks_product_features\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_features_path_idx\` ON \`products_blocks_product_features\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_product_specs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`show_requirements\` integer DEFAULT true,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_hidden\` integer DEFAULT false,
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_product_specs_order_idx\` ON \`products_blocks_product_specs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_specs_parent_id_idx\` ON \`products_blocks_product_specs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_specs_path_idx\` ON \`products_blocks_product_specs\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_product_editions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'lg',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_product_editions_order_idx\` ON \`products_blocks_product_editions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_editions_parent_id_idx\` ON \`products_blocks_product_editions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_editions_path_idx\` ON \`products_blocks_product_editions\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_product_downloads\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_hidden\` integer DEFAULT false,
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_product_downloads_order_idx\` ON \`products_blocks_product_downloads\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_downloads_parent_id_idx\` ON \`products_blocks_product_downloads\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_downloads_path_idx\` ON \`products_blocks_product_downloads\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_product_docs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_hidden\` integer DEFAULT false,
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_product_docs_order_idx\` ON \`products_blocks_product_docs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_docs_parent_id_idx\` ON \`products_blocks_product_docs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_docs_path_idx\` ON \`products_blocks_product_docs\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_product_hero\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'none',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_hero_order_idx\` ON \`_products_v_blocks_product_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_hero_parent_id_idx\` ON \`_products_v_blocks_product_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_hero_path_idx\` ON \`_products_v_blocks_product_hero\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_product_nav\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'none',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_hidden\` integer DEFAULT false,
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_nav_order_idx\` ON \`_products_v_blocks_product_nav\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_nav_parent_id_idx\` ON \`_products_v_blocks_product_nav\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_nav_path_idx\` ON \`_products_v_blocks_product_nav\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_product_overview\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_hidden\` integer DEFAULT false,
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_overview_order_idx\` ON \`_products_v_blocks_product_overview\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_overview_parent_id_idx\` ON \`_products_v_blocks_product_overview\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_overview_path_idx\` ON \`_products_v_blocks_product_overview\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_product_features\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_hidden\` integer DEFAULT false,
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_features_order_idx\` ON \`_products_v_blocks_product_features\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_features_parent_id_idx\` ON \`_products_v_blocks_product_features\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_features_path_idx\` ON \`_products_v_blocks_product_features\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_product_specs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`show_requirements\` integer DEFAULT true,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_hidden\` integer DEFAULT false,
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_specs_order_idx\` ON \`_products_v_blocks_product_specs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_specs_parent_id_idx\` ON \`_products_v_blocks_product_specs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_specs_path_idx\` ON \`_products_v_blocks_product_specs\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_product_editions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'lg',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_editions_order_idx\` ON \`_products_v_blocks_product_editions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_editions_parent_id_idx\` ON \`_products_v_blocks_product_editions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_editions_path_idx\` ON \`_products_v_blocks_product_editions\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_product_downloads\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_hidden\` integer DEFAULT false,
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_downloads_order_idx\` ON \`_products_v_blocks_product_downloads\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_downloads_parent_id_idx\` ON \`_products_v_blocks_product_downloads\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_downloads_path_idx\` ON \`_products_v_blocks_product_downloads\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_product_docs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_separator\` text DEFAULT 'none',
  	\`appearance_hidden\` integer DEFAULT false,
  	\`motion_preset\` text DEFAULT 'auto',
  	\`motion_trigger\` text DEFAULT 'scroll',
  	\`motion_duration\` text DEFAULT 'base',
  	\`motion_delay\` text DEFAULT '0',
  	\`motion_easing\` text DEFAULT 'soft',
  	\`motion_stagger\` text DEFAULT 'tight',
  	\`motion_mobile\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_docs_order_idx\` ON \`_products_v_blocks_product_docs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_docs_parent_id_idx\` ON \`_products_v_blocks_product_docs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_docs_path_idx\` ON \`_products_v_blocks_product_docs\` (\`_path\`);`)
  await db.run(sql`ALTER TABLE \`_products_v\` ADD \`autosave\` integer;`)
  await db.run(sql`CREATE INDEX \`_products_v_autosave_idx\` ON \`_products_v\` (\`autosave\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`products_blocks_product_hero\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_product_nav\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_product_overview\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_product_features\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_product_specs\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_product_editions\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_product_downloads\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_product_docs\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_product_hero\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_product_nav\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_product_overview\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_product_features\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_product_specs\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_product_editions\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_product_downloads\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_product_docs\`;`)
  await db.run(sql`DROP INDEX \`_products_v_autosave_idx\`;`)
  await db.run(sql`ALTER TABLE \`_products_v\` DROP COLUMN \`autosave\`;`)
}
