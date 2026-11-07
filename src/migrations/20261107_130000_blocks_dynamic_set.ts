import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`products_blocks_product_families\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_product_families_order_idx\` ON \`products_blocks_product_families\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_families_parent_id_idx\` ON \`products_blocks_product_families\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_families_path_idx\` ON \`products_blocks_product_families\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_product_families_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_product_families_locales_locale_parent_id_un\` ON \`products_blocks_product_families_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_product_showcase\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`family_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_product_showcase_order_idx\` ON \`products_blocks_product_showcase\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_showcase_parent_id_idx\` ON \`products_blocks_product_showcase\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_showcase_path_idx\` ON \`products_blocks_product_showcase\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_showcase_family_idx\` ON \`products_blocks_product_showcase\` (\`family_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_product_showcase_industry_idx\` ON \`products_blocks_product_showcase\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_product_showcase_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_product_showcase\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_product_showcase_locales_locale_parent_id_un\` ON \`products_blocks_product_showcase_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_solutions_grid\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_solutions_grid_order_idx\` ON \`products_blocks_solutions_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_solutions_grid_parent_id_idx\` ON \`products_blocks_solutions_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_solutions_grid_path_idx\` ON \`products_blocks_solutions_grid\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_solutions_grid_industry_idx\` ON \`products_blocks_solutions_grid\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_solutions_grid_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_solutions_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_solutions_grid_locales_locale_parent_id_uniq\` ON \`products_blocks_solutions_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_case_study\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`case_study_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_case_study_order_idx\` ON \`products_blocks_case_study\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_case_study_parent_id_idx\` ON \`products_blocks_case_study\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_case_study_path_idx\` ON \`products_blocks_case_study\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_case_study_case_study_idx\` ON \`products_blocks_case_study\` (\`case_study_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_case_study_industry_idx\` ON \`products_blocks_case_study\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_case_study_locales\` (
  	\`eyebrow\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_case_study_locales_locale_parent_id_unique\` ON \`products_blocks_case_study_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_news_list\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_news_list_order_idx\` ON \`products_blocks_news_list\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_news_list_parent_id_idx\` ON \`products_blocks_news_list\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_news_list_path_idx\` ON \`products_blocks_news_list\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_news_list_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_news_list\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_news_list_locales_locale_parent_id_unique\` ON \`products_blocks_news_list_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_product_families\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_families_order_idx\` ON \`_products_v_blocks_product_families\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_families_parent_id_idx\` ON \`_products_v_blocks_product_families\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_families_path_idx\` ON \`_products_v_blocks_product_families\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_product_families_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_product_families_locales_locale_parent_id\` ON \`_products_v_blocks_product_families_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_product_showcase\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`family_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_showcase_order_idx\` ON \`_products_v_blocks_product_showcase\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_showcase_parent_id_idx\` ON \`_products_v_blocks_product_showcase\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_showcase_path_idx\` ON \`_products_v_blocks_product_showcase\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_showcase_family_idx\` ON \`_products_v_blocks_product_showcase\` (\`family_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_product_showcase_industry_idx\` ON \`_products_v_blocks_product_showcase\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_product_showcase_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_product_showcase\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_product_showcase_locales_locale_parent_id\` ON \`_products_v_blocks_product_showcase_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_solutions_grid\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_solutions_grid_order_idx\` ON \`_products_v_blocks_solutions_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_solutions_grid_parent_id_idx\` ON \`_products_v_blocks_solutions_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_solutions_grid_path_idx\` ON \`_products_v_blocks_solutions_grid\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_solutions_grid_industry_idx\` ON \`_products_v_blocks_solutions_grid\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_solutions_grid_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_solutions_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_solutions_grid_locales_locale_parent_id_u\` ON \`_products_v_blocks_solutions_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_case_study\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`case_study_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_case_study_order_idx\` ON \`_products_v_blocks_case_study\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_case_study_parent_id_idx\` ON \`_products_v_blocks_case_study\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_case_study_path_idx\` ON \`_products_v_blocks_case_study\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_case_study_case_study_idx\` ON \`_products_v_blocks_case_study\` (\`case_study_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_case_study_industry_idx\` ON \`_products_v_blocks_case_study\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_case_study_locales\` (
  	\`eyebrow\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_case_study_locales_locale_parent_id_uniqu\` ON \`_products_v_blocks_case_study_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_news_list\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_news_list_order_idx\` ON \`_products_v_blocks_news_list\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_news_list_parent_id_idx\` ON \`_products_v_blocks_news_list\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_news_list_path_idx\` ON \`_products_v_blocks_news_list\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_news_list_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_news_list\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_news_list_locales_locale_parent_id_unique\` ON \`_products_v_blocks_news_list_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_product_families\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_product_families_order_idx\` ON \`solutions_blocks_product_families\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_product_families_parent_id_idx\` ON \`solutions_blocks_product_families\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_product_families_path_idx\` ON \`solutions_blocks_product_families\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_product_families_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_product_families_locales_locale_parent_id_u\` ON \`solutions_blocks_product_families_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_product_showcase\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`family_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_product_showcase_order_idx\` ON \`solutions_blocks_product_showcase\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_product_showcase_parent_id_idx\` ON \`solutions_blocks_product_showcase\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_product_showcase_path_idx\` ON \`solutions_blocks_product_showcase\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_product_showcase_family_idx\` ON \`solutions_blocks_product_showcase\` (\`family_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_product_showcase_industry_idx\` ON \`solutions_blocks_product_showcase\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_product_showcase_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_product_showcase\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_product_showcase_locales_locale_parent_id_u\` ON \`solutions_blocks_product_showcase_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_solutions_grid\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_solutions_grid_order_idx\` ON \`solutions_blocks_solutions_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_solutions_grid_parent_id_idx\` ON \`solutions_blocks_solutions_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_solutions_grid_path_idx\` ON \`solutions_blocks_solutions_grid\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_solutions_grid_industry_idx\` ON \`solutions_blocks_solutions_grid\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_solutions_grid_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_solutions_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_solutions_grid_locales_locale_parent_id_uni\` ON \`solutions_blocks_solutions_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_case_study\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`case_study_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_case_study_order_idx\` ON \`solutions_blocks_case_study\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_case_study_parent_id_idx\` ON \`solutions_blocks_case_study\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_case_study_path_idx\` ON \`solutions_blocks_case_study\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_case_study_case_study_idx\` ON \`solutions_blocks_case_study\` (\`case_study_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_case_study_industry_idx\` ON \`solutions_blocks_case_study\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_case_study_locales\` (
  	\`eyebrow\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_case_study_locales_locale_parent_id_unique\` ON \`solutions_blocks_case_study_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_news_list\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_news_list_order_idx\` ON \`solutions_blocks_news_list\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_news_list_parent_id_idx\` ON \`solutions_blocks_news_list\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_news_list_path_idx\` ON \`solutions_blocks_news_list\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_news_list_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_news_list\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_news_list_locales_locale_parent_id_unique\` ON \`solutions_blocks_news_list_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_product_families\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_product_families_order_idx\` ON \`_solutions_v_blocks_product_families\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_product_families_parent_id_idx\` ON \`_solutions_v_blocks_product_families\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_product_families_path_idx\` ON \`_solutions_v_blocks_product_families\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_product_families_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_product_families_locales_locale_parent_i\` ON \`_solutions_v_blocks_product_families_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_product_showcase\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`family_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_product_showcase_order_idx\` ON \`_solutions_v_blocks_product_showcase\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_product_showcase_parent_id_idx\` ON \`_solutions_v_blocks_product_showcase\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_product_showcase_path_idx\` ON \`_solutions_v_blocks_product_showcase\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_product_showcase_family_idx\` ON \`_solutions_v_blocks_product_showcase\` (\`family_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_product_showcase_industry_idx\` ON \`_solutions_v_blocks_product_showcase\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_product_showcase_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_product_showcase\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_product_showcase_locales_locale_parent_i\` ON \`_solutions_v_blocks_product_showcase_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_solutions_grid\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_solutions_grid_order_idx\` ON \`_solutions_v_blocks_solutions_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_solutions_grid_parent_id_idx\` ON \`_solutions_v_blocks_solutions_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_solutions_grid_path_idx\` ON \`_solutions_v_blocks_solutions_grid\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_solutions_grid_industry_idx\` ON \`_solutions_v_blocks_solutions_grid\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_solutions_grid_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_solutions_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_solutions_grid_locales_locale_parent_id_\` ON \`_solutions_v_blocks_solutions_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_case_study\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`case_study_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_case_study_order_idx\` ON \`_solutions_v_blocks_case_study\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_case_study_parent_id_idx\` ON \`_solutions_v_blocks_case_study\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_case_study_path_idx\` ON \`_solutions_v_blocks_case_study\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_case_study_case_study_idx\` ON \`_solutions_v_blocks_case_study\` (\`case_study_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_case_study_industry_idx\` ON \`_solutions_v_blocks_case_study\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_case_study_locales\` (
  	\`eyebrow\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_case_study_locales_locale_parent_id_uniq\` ON \`_solutions_v_blocks_case_study_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_news_list\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_news_list_order_idx\` ON \`_solutions_v_blocks_news_list\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_news_list_parent_id_idx\` ON \`_solutions_v_blocks_news_list\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_news_list_path_idx\` ON \`_solutions_v_blocks_news_list\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_news_list_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_news_list\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_news_list_locales_locale_parent_id_uniqu\` ON \`_solutions_v_blocks_news_list_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_product_families\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_product_families_order_idx\` ON \`case_studies_blocks_product_families\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_product_families_parent_id_idx\` ON \`case_studies_blocks_product_families\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_product_families_path_idx\` ON \`case_studies_blocks_product_families\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_product_families_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_product_families_locales_locale_parent_i\` ON \`case_studies_blocks_product_families_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_product_showcase\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`family_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_product_showcase_order_idx\` ON \`case_studies_blocks_product_showcase\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_product_showcase_parent_id_idx\` ON \`case_studies_blocks_product_showcase\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_product_showcase_path_idx\` ON \`case_studies_blocks_product_showcase\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_product_showcase_family_idx\` ON \`case_studies_blocks_product_showcase\` (\`family_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_product_showcase_industry_idx\` ON \`case_studies_blocks_product_showcase\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_product_showcase_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_product_showcase\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_product_showcase_locales_locale_parent_i\` ON \`case_studies_blocks_product_showcase_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_solutions_grid\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_solutions_grid_order_idx\` ON \`case_studies_blocks_solutions_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_solutions_grid_parent_id_idx\` ON \`case_studies_blocks_solutions_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_solutions_grid_path_idx\` ON \`case_studies_blocks_solutions_grid\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_solutions_grid_industry_idx\` ON \`case_studies_blocks_solutions_grid\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_solutions_grid_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_solutions_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_solutions_grid_locales_locale_parent_id_\` ON \`case_studies_blocks_solutions_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_case_study\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`case_study_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_case_study_order_idx\` ON \`case_studies_blocks_case_study\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_case_study_parent_id_idx\` ON \`case_studies_blocks_case_study\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_case_study_path_idx\` ON \`case_studies_blocks_case_study\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_case_study_case_study_idx\` ON \`case_studies_blocks_case_study\` (\`case_study_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_case_study_industry_idx\` ON \`case_studies_blocks_case_study\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_case_study_locales\` (
  	\`eyebrow\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_case_study_locales_locale_parent_id_uniq\` ON \`case_studies_blocks_case_study_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_news_list\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_news_list_order_idx\` ON \`case_studies_blocks_news_list\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_news_list_parent_id_idx\` ON \`case_studies_blocks_news_list\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_news_list_path_idx\` ON \`case_studies_blocks_news_list\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_news_list_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_news_list\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_news_list_locales_locale_parent_id_uniqu\` ON \`case_studies_blocks_news_list_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_product_families\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_product_families_order_idx\` ON \`_case_studies_v_blocks_product_families\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_product_families_parent_id_idx\` ON \`_case_studies_v_blocks_product_families\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_product_families_path_idx\` ON \`_case_studies_v_blocks_product_families\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_product_families_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_product_families_locales_locale_paren\` ON \`_case_studies_v_blocks_product_families_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_product_showcase\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`family_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_product_showcase_order_idx\` ON \`_case_studies_v_blocks_product_showcase\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_product_showcase_parent_id_idx\` ON \`_case_studies_v_blocks_product_showcase\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_product_showcase_path_idx\` ON \`_case_studies_v_blocks_product_showcase\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_product_showcase_family_idx\` ON \`_case_studies_v_blocks_product_showcase\` (\`family_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_product_showcase_industry_idx\` ON \`_case_studies_v_blocks_product_showcase\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_product_showcase_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_product_showcase\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_product_showcase_locales_locale_paren\` ON \`_case_studies_v_blocks_product_showcase_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_solutions_grid\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_solutions_grid_order_idx\` ON \`_case_studies_v_blocks_solutions_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_solutions_grid_parent_id_idx\` ON \`_case_studies_v_blocks_solutions_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_solutions_grid_path_idx\` ON \`_case_studies_v_blocks_solutions_grid\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_solutions_grid_industry_idx\` ON \`_case_studies_v_blocks_solutions_grid\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_solutions_grid_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_solutions_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_solutions_grid_locales_locale_parent_\` ON \`_case_studies_v_blocks_solutions_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_case_study\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`case_study_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_case_study_order_idx\` ON \`_case_studies_v_blocks_case_study\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_case_study_parent_id_idx\` ON \`_case_studies_v_blocks_case_study\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_case_study_path_idx\` ON \`_case_studies_v_blocks_case_study\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_case_study_case_study_idx\` ON \`_case_studies_v_blocks_case_study\` (\`case_study_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_case_study_industry_idx\` ON \`_case_studies_v_blocks_case_study\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_case_study_locales\` (
  	\`eyebrow\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_case_study_locales_locale_parent_id_u\` ON \`_case_studies_v_blocks_case_study_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_news_list\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_news_list_order_idx\` ON \`_case_studies_v_blocks_news_list\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_news_list_parent_id_idx\` ON \`_case_studies_v_blocks_news_list\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_news_list_path_idx\` ON \`_case_studies_v_blocks_news_list\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_news_list_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_news_list\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_news_list_locales_locale_parent_id_un\` ON \`_case_studies_v_blocks_news_list_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_product_families\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_product_families_order_idx\` ON \`pages_blocks_product_families\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_product_families_parent_id_idx\` ON \`pages_blocks_product_families\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_product_families_path_idx\` ON \`pages_blocks_product_families\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_product_families_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_product_families_locales_locale_parent_id_uniqu\` ON \`pages_blocks_product_families_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_product_showcase\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`family_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_product_showcase_order_idx\` ON \`pages_blocks_product_showcase\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_product_showcase_parent_id_idx\` ON \`pages_blocks_product_showcase\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_product_showcase_path_idx\` ON \`pages_blocks_product_showcase\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_product_showcase_family_idx\` ON \`pages_blocks_product_showcase\` (\`family_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_product_showcase_industry_idx\` ON \`pages_blocks_product_showcase\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_product_showcase_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_product_showcase\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_product_showcase_locales_locale_parent_id_uniqu\` ON \`pages_blocks_product_showcase_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_solutions_grid\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_solutions_grid_order_idx\` ON \`pages_blocks_solutions_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_solutions_grid_parent_id_idx\` ON \`pages_blocks_solutions_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_solutions_grid_path_idx\` ON \`pages_blocks_solutions_grid\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_solutions_grid_industry_idx\` ON \`pages_blocks_solutions_grid\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_solutions_grid_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_solutions_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_solutions_grid_locales_locale_parent_id_unique\` ON \`pages_blocks_solutions_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_case_study\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`case_study_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_case_study_order_idx\` ON \`pages_blocks_case_study\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_case_study_parent_id_idx\` ON \`pages_blocks_case_study\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_case_study_path_idx\` ON \`pages_blocks_case_study\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_case_study_case_study_idx\` ON \`pages_blocks_case_study\` (\`case_study_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_case_study_industry_idx\` ON \`pages_blocks_case_study\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_case_study_locales\` (
  	\`eyebrow\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_case_study_locales_locale_parent_id_unique\` ON \`pages_blocks_case_study_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_news_list\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_news_list_order_idx\` ON \`pages_blocks_news_list\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_news_list_parent_id_idx\` ON \`pages_blocks_news_list\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_news_list_path_idx\` ON \`pages_blocks_news_list\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_news_list_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_news_list\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_news_list_locales_locale_parent_id_unique\` ON \`pages_blocks_news_list_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_product_families\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_product_families_order_idx\` ON \`_pages_v_blocks_product_families\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_product_families_parent_id_idx\` ON \`_pages_v_blocks_product_families\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_product_families_path_idx\` ON \`_pages_v_blocks_product_families\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_product_families_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_product_families\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_product_families_locales_locale_parent_id_un\` ON \`_pages_v_blocks_product_families_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_product_showcase\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`family_id\`) REFERENCES \`product_families\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_product_showcase_order_idx\` ON \`_pages_v_blocks_product_showcase\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_product_showcase_parent_id_idx\` ON \`_pages_v_blocks_product_showcase\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_product_showcase_path_idx\` ON \`_pages_v_blocks_product_showcase\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_product_showcase_family_idx\` ON \`_pages_v_blocks_product_showcase\` (\`family_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_product_showcase_industry_idx\` ON \`_pages_v_blocks_product_showcase\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_product_showcase_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_product_showcase\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_product_showcase_locales_locale_parent_id_un\` ON \`_pages_v_blocks_product_showcase_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_solutions_grid\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_solutions_grid_order_idx\` ON \`_pages_v_blocks_solutions_grid\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_solutions_grid_parent_id_idx\` ON \`_pages_v_blocks_solutions_grid\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_solutions_grid_path_idx\` ON \`_pages_v_blocks_solutions_grid\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_solutions_grid_industry_idx\` ON \`_pages_v_blocks_solutions_grid\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_solutions_grid_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_solutions_grid\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_solutions_grid_locales_locale_parent_id_uniq\` ON \`_pages_v_blocks_solutions_grid_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_case_study\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`case_study_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`industry_id\`) REFERENCES \`industries\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_case_study_order_idx\` ON \`_pages_v_blocks_case_study\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_case_study_parent_id_idx\` ON \`_pages_v_blocks_case_study\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_case_study_path_idx\` ON \`_pages_v_blocks_case_study\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_case_study_case_study_idx\` ON \`_pages_v_blocks_case_study\` (\`case_study_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_case_study_industry_idx\` ON \`_pages_v_blocks_case_study\` (\`industry_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_case_study_locales\` (
  	\`eyebrow\` text,
  	\`link_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_case_study_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_case_study_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_news_list\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_news_list_order_idx\` ON \`_pages_v_blocks_news_list\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_news_list_parent_id_idx\` ON \`_pages_v_blocks_news_list\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_news_list_path_idx\` ON \`_pages_v_blocks_news_list\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_news_list_locales\` (
  	\`eyebrow\` text,
  	\`heading\` text,
  	\`description\` text,
  	\`view_all_label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_news_list\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_news_list_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_news_list_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`ALTER TABLE \`products_blocks_logo_wall\` ADD \`limit\` numeric DEFAULT 12;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_logo_wall\` ADD \`limit\` numeric DEFAULT 12;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_logo_wall\` ADD \`limit\` numeric DEFAULT 12;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_logo_wall\` ADD \`limit\` numeric DEFAULT 12;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_logo_wall\` ADD \`limit\` numeric DEFAULT 12;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_logo_wall\` ADD \`limit\` numeric DEFAULT 12;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_logo_wall\` ADD \`limit\` numeric DEFAULT 12;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_logo_wall\` ADD \`limit\` numeric DEFAULT 12;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`products_blocks_product_families\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_product_families_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_product_showcase\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_product_showcase_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_solutions_grid\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_solutions_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_case_study\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_case_study_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_news_list\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_news_list_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_product_families\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_product_families_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_product_showcase\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_product_showcase_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_solutions_grid\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_solutions_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_case_study\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_case_study_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_news_list\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_news_list_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_product_families\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_product_families_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_product_showcase\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_product_showcase_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_solutions_grid\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_solutions_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_case_study\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_case_study_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_news_list\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_news_list_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_product_families\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_product_families_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_product_showcase\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_product_showcase_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_solutions_grid\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_solutions_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_case_study\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_case_study_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_news_list\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_news_list_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_product_families\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_product_families_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_product_showcase\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_product_showcase_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_solutions_grid\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_solutions_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_case_study\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_case_study_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_news_list\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_news_list_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_product_families\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_product_families_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_product_showcase\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_product_showcase_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_solutions_grid\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_solutions_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_case_study\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_case_study_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_news_list\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_news_list_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_product_families\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_product_families_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_product_showcase\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_product_showcase_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_solutions_grid\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_solutions_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_case_study\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_case_study_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_news_list\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_news_list_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_product_families\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_product_families_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_product_showcase\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_product_showcase_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_solutions_grid\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_solutions_grid_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_case_study\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_case_study_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_news_list\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_news_list_locales\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_logo_wall\` DROP COLUMN \`limit\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_logo_wall\` DROP COLUMN \`limit\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_logo_wall\` DROP COLUMN \`limit\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_logo_wall\` DROP COLUMN \`limit\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_logo_wall\` DROP COLUMN \`limit\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_logo_wall\` DROP COLUMN \`limit\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_logo_wall\` DROP COLUMN \`limit\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_logo_wall\` DROP COLUMN \`limit\`;`)
}
