import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`products_blocks_media_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_media_items_order_idx\` ON \`products_blocks_media_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_media_items_parent_id_idx\` ON \`products_blocks_media_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_media_items_image_idx\` ON \`products_blocks_media_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_media_items_locales\` (
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_media_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_media_items_locales_locale_parent_id_unique\` ON \`products_blocks_media_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_media\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_media_order_idx\` ON \`products_blocks_media\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_media_parent_id_idx\` ON \`products_blocks_media\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_media_path_idx\` ON \`products_blocks_media\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_media_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_media_locales_locale_parent_id_unique\` ON \`products_blocks_media_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_testimonial\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`company\` text,
  	\`photo_id\` integer,
  	\`logo_id\` integer,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'center',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_testimonial_order_idx\` ON \`products_blocks_testimonial\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_testimonial_parent_id_idx\` ON \`products_blocks_testimonial\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_testimonial_path_idx\` ON \`products_blocks_testimonial\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_testimonial_photo_idx\` ON \`products_blocks_testimonial\` (\`photo_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_testimonial_logo_idx\` ON \`products_blocks_testimonial\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_testimonial_locales\` (
  	\`quote\` text,
  	\`role\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_testimonial\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_testimonial_locales_locale_parent_id_unique\` ON \`products_blocks_testimonial_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_tabs_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_tabs_items_order_idx\` ON \`products_blocks_tabs_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_tabs_items_parent_id_idx\` ON \`products_blocks_tabs_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_tabs_items_media_idx\` ON \`products_blocks_tabs_items\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_tabs_items_locales\` (
  	\`label\` text,
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_tabs_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_tabs_items_locales_locale_parent_id_unique\` ON \`products_blocks_tabs_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_tabs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_tabs_order_idx\` ON \`products_blocks_tabs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_tabs_parent_id_idx\` ON \`products_blocks_tabs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_tabs_path_idx\` ON \`products_blocks_tabs\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_tabs_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_blocks_tabs_locales_locale_parent_id_unique\` ON \`products_blocks_tabs_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_spacer\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`size\` text DEFAULT 'md',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'none',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_spacer_order_idx\` ON \`products_blocks_spacer\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_spacer_parent_id_idx\` ON \`products_blocks_spacer\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_spacer_path_idx\` ON \`products_blocks_spacer\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`products_blocks_divider\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_blocks_divider_order_idx\` ON \`products_blocks_divider\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_divider_parent_id_idx\` ON \`products_blocks_divider\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`products_blocks_divider_path_idx\` ON \`products_blocks_divider\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_media_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_media_items_order_idx\` ON \`_products_v_blocks_media_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_media_items_parent_id_idx\` ON \`_products_v_blocks_media_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_media_items_image_idx\` ON \`_products_v_blocks_media_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_media_items_locales\` (
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_media_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_media_items_locales_locale_parent_id_uniq\` ON \`_products_v_blocks_media_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_media\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`aspect\` text DEFAULT 'auto',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
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
  await db.run(sql`CREATE INDEX \`_products_v_blocks_media_order_idx\` ON \`_products_v_blocks_media\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_media_parent_id_idx\` ON \`_products_v_blocks_media\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_media_path_idx\` ON \`_products_v_blocks_media\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_media_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_media_locales_locale_parent_id_unique\` ON \`_products_v_blocks_media_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_testimonial\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`company\` text,
  	\`photo_id\` integer,
  	\`logo_id\` integer,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'center',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_testimonial_order_idx\` ON \`_products_v_blocks_testimonial\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_testimonial_parent_id_idx\` ON \`_products_v_blocks_testimonial\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_testimonial_path_idx\` ON \`_products_v_blocks_testimonial\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_testimonial_photo_idx\` ON \`_products_v_blocks_testimonial\` (\`photo_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_testimonial_logo_idx\` ON \`_products_v_blocks_testimonial\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_testimonial_locales\` (
  	\`quote\` text,
  	\`role\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_testimonial\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_testimonial_locales_locale_parent_id_uniq\` ON \`_products_v_blocks_testimonial_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_tabs_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_tabs_items_order_idx\` ON \`_products_v_blocks_tabs_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_tabs_items_parent_id_idx\` ON \`_products_v_blocks_tabs_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_tabs_items_media_idx\` ON \`_products_v_blocks_tabs_items\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_tabs_items_locales\` (
  	\`label\` text,
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_tabs_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_tabs_items_locales_locale_parent_id_uniqu\` ON \`_products_v_blocks_tabs_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_tabs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
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
  await db.run(sql`CREATE INDEX \`_products_v_blocks_tabs_order_idx\` ON \`_products_v_blocks_tabs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_tabs_parent_id_idx\` ON \`_products_v_blocks_tabs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_tabs_path_idx\` ON \`_products_v_blocks_tabs\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_tabs_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_products_v_blocks_tabs_locales_locale_parent_id_unique\` ON \`_products_v_blocks_tabs_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_spacer\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`size\` text DEFAULT 'md',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'none',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_spacer_order_idx\` ON \`_products_v_blocks_spacer\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_spacer_parent_id_idx\` ON \`_products_v_blocks_spacer\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_spacer_path_idx\` ON \`_products_v_blocks_spacer\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_products_v_blocks_divider\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`style\` text DEFAULT 'line',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'sm',
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
  await db.run(sql`CREATE INDEX \`_products_v_blocks_divider_order_idx\` ON \`_products_v_blocks_divider\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_divider_parent_id_idx\` ON \`_products_v_blocks_divider\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_divider_path_idx\` ON \`_products_v_blocks_divider\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_media_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_media_items_order_idx\` ON \`solutions_blocks_media_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_media_items_parent_id_idx\` ON \`solutions_blocks_media_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_media_items_image_idx\` ON \`solutions_blocks_media_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_media_items_locales\` (
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_media_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_media_items_locales_locale_parent_id_unique\` ON \`solutions_blocks_media_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_media\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_media_order_idx\` ON \`solutions_blocks_media\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_media_parent_id_idx\` ON \`solutions_blocks_media\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_media_path_idx\` ON \`solutions_blocks_media\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_media_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_media_locales_locale_parent_id_unique\` ON \`solutions_blocks_media_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_testimonial\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`company\` text,
  	\`photo_id\` integer,
  	\`logo_id\` integer,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'center',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_testimonial_order_idx\` ON \`solutions_blocks_testimonial\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_testimonial_parent_id_idx\` ON \`solutions_blocks_testimonial\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_testimonial_path_idx\` ON \`solutions_blocks_testimonial\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_testimonial_photo_idx\` ON \`solutions_blocks_testimonial\` (\`photo_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_testimonial_logo_idx\` ON \`solutions_blocks_testimonial\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_testimonial_locales\` (
  	\`quote\` text,
  	\`role\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_testimonial\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_testimonial_locales_locale_parent_id_unique\` ON \`solutions_blocks_testimonial_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_tabs_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_tabs_items_order_idx\` ON \`solutions_blocks_tabs_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_tabs_items_parent_id_idx\` ON \`solutions_blocks_tabs_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_tabs_items_media_idx\` ON \`solutions_blocks_tabs_items\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_tabs_items_locales\` (
  	\`label\` text,
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_tabs_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_tabs_items_locales_locale_parent_id_unique\` ON \`solutions_blocks_tabs_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_tabs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_tabs_order_idx\` ON \`solutions_blocks_tabs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_tabs_parent_id_idx\` ON \`solutions_blocks_tabs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_tabs_path_idx\` ON \`solutions_blocks_tabs\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_tabs_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`solutions_blocks_tabs_locales_locale_parent_id_unique\` ON \`solutions_blocks_tabs_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_spacer\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`size\` text DEFAULT 'md',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'none',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_spacer_order_idx\` ON \`solutions_blocks_spacer\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_spacer_parent_id_idx\` ON \`solutions_blocks_spacer\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_spacer_path_idx\` ON \`solutions_blocks_spacer\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`solutions_blocks_divider\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`solutions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`solutions_blocks_divider_order_idx\` ON \`solutions_blocks_divider\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_divider_parent_id_idx\` ON \`solutions_blocks_divider\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_divider_path_idx\` ON \`solutions_blocks_divider\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_media_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_media_items_order_idx\` ON \`_solutions_v_blocks_media_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_media_items_parent_id_idx\` ON \`_solutions_v_blocks_media_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_media_items_image_idx\` ON \`_solutions_v_blocks_media_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_media_items_locales\` (
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_media_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_media_items_locales_locale_parent_id_uni\` ON \`_solutions_v_blocks_media_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_media\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`aspect\` text DEFAULT 'auto',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
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
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_media_order_idx\` ON \`_solutions_v_blocks_media\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_media_parent_id_idx\` ON \`_solutions_v_blocks_media\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_media_path_idx\` ON \`_solutions_v_blocks_media\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_media_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_media_locales_locale_parent_id_unique\` ON \`_solutions_v_blocks_media_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_testimonial\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`company\` text,
  	\`photo_id\` integer,
  	\`logo_id\` integer,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'center',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_testimonial_order_idx\` ON \`_solutions_v_blocks_testimonial\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_testimonial_parent_id_idx\` ON \`_solutions_v_blocks_testimonial\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_testimonial_path_idx\` ON \`_solutions_v_blocks_testimonial\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_testimonial_photo_idx\` ON \`_solutions_v_blocks_testimonial\` (\`photo_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_testimonial_logo_idx\` ON \`_solutions_v_blocks_testimonial\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_testimonial_locales\` (
  	\`quote\` text,
  	\`role\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_testimonial\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_testimonial_locales_locale_parent_id_uni\` ON \`_solutions_v_blocks_testimonial_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_tabs_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_tabs_items_order_idx\` ON \`_solutions_v_blocks_tabs_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_tabs_items_parent_id_idx\` ON \`_solutions_v_blocks_tabs_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_tabs_items_media_idx\` ON \`_solutions_v_blocks_tabs_items\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_tabs_items_locales\` (
  	\`label\` text,
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_tabs_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_tabs_items_locales_locale_parent_id_uniq\` ON \`_solutions_v_blocks_tabs_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_tabs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
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
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_tabs_order_idx\` ON \`_solutions_v_blocks_tabs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_tabs_parent_id_idx\` ON \`_solutions_v_blocks_tabs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_tabs_path_idx\` ON \`_solutions_v_blocks_tabs\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_tabs_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_solutions_v_blocks_tabs_locales_locale_parent_id_unique\` ON \`_solutions_v_blocks_tabs_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_spacer\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`size\` text DEFAULT 'md',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'none',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_solutions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_spacer_order_idx\` ON \`_solutions_v_blocks_spacer\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_spacer_parent_id_idx\` ON \`_solutions_v_blocks_spacer\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_spacer_path_idx\` ON \`_solutions_v_blocks_spacer\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_solutions_v_blocks_divider\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`style\` text DEFAULT 'line',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'sm',
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
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_divider_order_idx\` ON \`_solutions_v_blocks_divider\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_divider_parent_id_idx\` ON \`_solutions_v_blocks_divider\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_divider_path_idx\` ON \`_solutions_v_blocks_divider\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_media_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_media_items_order_idx\` ON \`case_studies_blocks_media_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_media_items_parent_id_idx\` ON \`case_studies_blocks_media_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_media_items_image_idx\` ON \`case_studies_blocks_media_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_media_items_locales\` (
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_media_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_media_items_locales_locale_parent_id_uni\` ON \`case_studies_blocks_media_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_media\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_media_order_idx\` ON \`case_studies_blocks_media\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_media_parent_id_idx\` ON \`case_studies_blocks_media\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_media_path_idx\` ON \`case_studies_blocks_media\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_media_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_media_locales_locale_parent_id_unique\` ON \`case_studies_blocks_media_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_testimonial\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`company\` text,
  	\`photo_id\` integer,
  	\`logo_id\` integer,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'center',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_testimonial_order_idx\` ON \`case_studies_blocks_testimonial\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_testimonial_parent_id_idx\` ON \`case_studies_blocks_testimonial\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_testimonial_path_idx\` ON \`case_studies_blocks_testimonial\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_testimonial_photo_idx\` ON \`case_studies_blocks_testimonial\` (\`photo_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_testimonial_logo_idx\` ON \`case_studies_blocks_testimonial\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_testimonial_locales\` (
  	\`quote\` text,
  	\`role\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_testimonial\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_testimonial_locales_locale_parent_id_uni\` ON \`case_studies_blocks_testimonial_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_tabs_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_tabs_items_order_idx\` ON \`case_studies_blocks_tabs_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_tabs_items_parent_id_idx\` ON \`case_studies_blocks_tabs_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_tabs_items_media_idx\` ON \`case_studies_blocks_tabs_items\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_tabs_items_locales\` (
  	\`label\` text,
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_tabs_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_tabs_items_locales_locale_parent_id_uniq\` ON \`case_studies_blocks_tabs_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_tabs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_tabs_order_idx\` ON \`case_studies_blocks_tabs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_tabs_parent_id_idx\` ON \`case_studies_blocks_tabs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_tabs_path_idx\` ON \`case_studies_blocks_tabs\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_tabs_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_studies_blocks_tabs_locales_locale_parent_id_unique\` ON \`case_studies_blocks_tabs_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_spacer\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`size\` text DEFAULT 'md',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'none',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_spacer_order_idx\` ON \`case_studies_blocks_spacer\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_spacer_parent_id_idx\` ON \`case_studies_blocks_spacer\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_spacer_path_idx\` ON \`case_studies_blocks_spacer\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`case_studies_blocks_divider\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_studies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_divider_order_idx\` ON \`case_studies_blocks_divider\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_divider_parent_id_idx\` ON \`case_studies_blocks_divider\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_divider_path_idx\` ON \`case_studies_blocks_divider\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_media_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_media_items_order_idx\` ON \`_case_studies_v_blocks_media_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_media_items_parent_id_idx\` ON \`_case_studies_v_blocks_media_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_media_items_image_idx\` ON \`_case_studies_v_blocks_media_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_media_items_locales\` (
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_media_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_media_items_locales_locale_parent_id_\` ON \`_case_studies_v_blocks_media_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_media\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`aspect\` text DEFAULT 'auto',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
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
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_media_order_idx\` ON \`_case_studies_v_blocks_media\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_media_parent_id_idx\` ON \`_case_studies_v_blocks_media\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_media_path_idx\` ON \`_case_studies_v_blocks_media\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_media_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_media_locales_locale_parent_id_unique\` ON \`_case_studies_v_blocks_media_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_testimonial\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`company\` text,
  	\`photo_id\` integer,
  	\`logo_id\` integer,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'center',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_testimonial_order_idx\` ON \`_case_studies_v_blocks_testimonial\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_testimonial_parent_id_idx\` ON \`_case_studies_v_blocks_testimonial\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_testimonial_path_idx\` ON \`_case_studies_v_blocks_testimonial\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_testimonial_photo_idx\` ON \`_case_studies_v_blocks_testimonial\` (\`photo_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_testimonial_logo_idx\` ON \`_case_studies_v_blocks_testimonial\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_testimonial_locales\` (
  	\`quote\` text,
  	\`role\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_testimonial\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_testimonial_locales_locale_parent_id_\` ON \`_case_studies_v_blocks_testimonial_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_tabs_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_tabs_items_order_idx\` ON \`_case_studies_v_blocks_tabs_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_tabs_items_parent_id_idx\` ON \`_case_studies_v_blocks_tabs_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_tabs_items_media_idx\` ON \`_case_studies_v_blocks_tabs_items\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_tabs_items_locales\` (
  	\`label\` text,
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_tabs_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_tabs_items_locales_locale_parent_id_u\` ON \`_case_studies_v_blocks_tabs_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_tabs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
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
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_tabs_order_idx\` ON \`_case_studies_v_blocks_tabs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_tabs_parent_id_idx\` ON \`_case_studies_v_blocks_tabs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_tabs_path_idx\` ON \`_case_studies_v_blocks_tabs\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_tabs_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_case_studies_v_blocks_tabs_locales_locale_parent_id_unique\` ON \`_case_studies_v_blocks_tabs_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_spacer\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`size\` text DEFAULT 'md',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'none',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_studies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_spacer_order_idx\` ON \`_case_studies_v_blocks_spacer\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_spacer_parent_id_idx\` ON \`_case_studies_v_blocks_spacer\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_spacer_path_idx\` ON \`_case_studies_v_blocks_spacer\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_case_studies_v_blocks_divider\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`style\` text DEFAULT 'line',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'sm',
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
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_divider_order_idx\` ON \`_case_studies_v_blocks_divider\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_divider_parent_id_idx\` ON \`_case_studies_v_blocks_divider\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_divider_path_idx\` ON \`_case_studies_v_blocks_divider\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_media_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_media_items_order_idx\` ON \`pages_blocks_media_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_media_items_parent_id_idx\` ON \`pages_blocks_media_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_media_items_image_idx\` ON \`pages_blocks_media_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_media_items_locales\` (
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_media_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_media_items_locales_locale_parent_id_unique\` ON \`pages_blocks_media_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_media\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_media_order_idx\` ON \`pages_blocks_media\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_media_parent_id_idx\` ON \`pages_blocks_media\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_media_path_idx\` ON \`pages_blocks_media\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_media_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_media_locales_locale_parent_id_unique\` ON \`pages_blocks_media_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_testimonial\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`company\` text,
  	\`photo_id\` integer,
  	\`logo_id\` integer,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'center',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_testimonial_order_idx\` ON \`pages_blocks_testimonial\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_testimonial_parent_id_idx\` ON \`pages_blocks_testimonial\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_testimonial_path_idx\` ON \`pages_blocks_testimonial\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_testimonial_photo_idx\` ON \`pages_blocks_testimonial\` (\`photo_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_testimonial_logo_idx\` ON \`pages_blocks_testimonial\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_testimonial_locales\` (
  	\`quote\` text,
  	\`role\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_testimonial\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_testimonial_locales_locale_parent_id_unique\` ON \`pages_blocks_testimonial_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_tabs_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_tabs_items_order_idx\` ON \`pages_blocks_tabs_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_tabs_items_parent_id_idx\` ON \`pages_blocks_tabs_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_tabs_items_media_idx\` ON \`pages_blocks_tabs_items\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_tabs_items_locales\` (
  	\`label\` text,
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_tabs_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_tabs_items_locales_locale_parent_id_unique\` ON \`pages_blocks_tabs_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_tabs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_tabs_order_idx\` ON \`pages_blocks_tabs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_tabs_parent_id_idx\` ON \`pages_blocks_tabs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_tabs_path_idx\` ON \`pages_blocks_tabs\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_tabs_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_tabs_locales_locale_parent_id_unique\` ON \`pages_blocks_tabs_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_spacer\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`size\` text DEFAULT 'md',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'none',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_spacer_order_idx\` ON \`pages_blocks_spacer\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_spacer_parent_id_idx\` ON \`pages_blocks_spacer\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_spacer_path_idx\` ON \`pages_blocks_spacer\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_divider\` (
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
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_divider_order_idx\` ON \`pages_blocks_divider\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_divider_parent_id_idx\` ON \`pages_blocks_divider\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_divider_path_idx\` ON \`pages_blocks_divider\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_media_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_media_items_order_idx\` ON \`_pages_v_blocks_media_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_media_items_parent_id_idx\` ON \`_pages_v_blocks_media_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_media_items_image_idx\` ON \`_pages_v_blocks_media_items\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_media_items_locales\` (
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_media_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_media_items_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_media_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_media\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`aspect\` text DEFAULT 'auto',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
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
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_media_order_idx\` ON \`_pages_v_blocks_media\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_media_parent_id_idx\` ON \`_pages_v_blocks_media\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_media_path_idx\` ON \`_pages_v_blocks_media\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_media_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_media_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_media_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_testimonial\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`company\` text,
  	\`photo_id\` integer,
  	\`logo_id\` integer,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'center',
  	\`appearance_width\` text DEFAULT 'normal',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_testimonial_order_idx\` ON \`_pages_v_blocks_testimonial\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_testimonial_parent_id_idx\` ON \`_pages_v_blocks_testimonial\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_testimonial_path_idx\` ON \`_pages_v_blocks_testimonial\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_testimonial_photo_idx\` ON \`_pages_v_blocks_testimonial\` (\`photo_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_testimonial_logo_idx\` ON \`_pages_v_blocks_testimonial\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_testimonial_locales\` (
  	\`quote\` text,
  	\`role\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_testimonial\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_testimonial_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_testimonial_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_tabs_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`media_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_tabs_items_order_idx\` ON \`_pages_v_blocks_tabs_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_tabs_items_parent_id_idx\` ON \`_pages_v_blocks_tabs_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_tabs_items_media_idx\` ON \`_pages_v_blocks_tabs_items\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_tabs_items_locales\` (
  	\`label\` text,
  	\`content\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_tabs_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_tabs_items_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_tabs_items_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_tabs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'md',
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
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_tabs_order_idx\` ON \`_pages_v_blocks_tabs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_tabs_parent_id_idx\` ON \`_pages_v_blocks_tabs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_tabs_path_idx\` ON \`_pages_v_blocks_tabs\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_tabs_locales\` (
  	\`heading\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_tabs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_tabs_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_tabs_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_spacer\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`size\` text DEFAULT 'md',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'none',
  	\`appearance_animation\` text DEFAULT 'subtle',
  	\`appearance_align\` text DEFAULT 'start',
  	\`appearance_anchor\` text,
  	\`appearance_hidden\` integer DEFAULT false,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_spacer_order_idx\` ON \`_pages_v_blocks_spacer\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_spacer_parent_id_idx\` ON \`_pages_v_blocks_spacer\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_spacer_path_idx\` ON \`_pages_v_blocks_spacer\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_divider\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`style\` text DEFAULT 'line',
  	\`appearance_theme\` text DEFAULT 'auto',
  	\`appearance_spacing\` text DEFAULT 'sm',
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
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_divider_order_idx\` ON \`_pages_v_blocks_divider\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_divider_parent_id_idx\` ON \`_pages_v_blocks_divider\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_divider_path_idx\` ON \`_pages_v_blocks_divider\` (\`_path\`);`)
  await db.run(sql`ALTER TABLE \`products_blocks_hero\` ADD \`video_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`products_blocks_hero_video_idx\` ON \`products_blocks_hero\` (\`video_id\`);`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_hero\` ADD \`video_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`_products_v_blocks_hero_video_idx\` ON \`_products_v_blocks_hero\` (\`video_id\`);`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_hero\` ADD \`video_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`solutions_blocks_hero_video_idx\` ON \`solutions_blocks_hero\` (\`video_id\`);`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_hero\` ADD \`video_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`_solutions_v_blocks_hero_video_idx\` ON \`_solutions_v_blocks_hero\` (\`video_id\`);`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_hero\` ADD \`video_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`case_studies_blocks_hero_video_idx\` ON \`case_studies_blocks_hero\` (\`video_id\`);`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_hero\` ADD \`video_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`_case_studies_v_blocks_hero_video_idx\` ON \`_case_studies_v_blocks_hero\` (\`video_id\`);`)
  await db.run(sql`ALTER TABLE \`pages_blocks_hero\` ADD \`video_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_hero_video_idx\` ON \`pages_blocks_hero\` (\`video_id\`);`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_hero\` ADD \`video_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_hero_video_idx\` ON \`_pages_v_blocks_hero\` (\`video_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`products_blocks_media_items\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_media_items_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_media\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_media_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_testimonial\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_testimonial_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_tabs_items\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_tabs_items_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_tabs\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_tabs_locales\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_spacer\`;`)
  await db.run(sql`DROP TABLE \`products_blocks_divider\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_media_items\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_media_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_media\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_media_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_testimonial\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_testimonial_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_tabs_items\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_tabs_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_tabs\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_tabs_locales\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_spacer\`;`)
  await db.run(sql`DROP TABLE \`_products_v_blocks_divider\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_media_items\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_media_items_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_media\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_media_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_testimonial\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_testimonial_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_tabs_items\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_tabs_items_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_tabs\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_tabs_locales\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_spacer\`;`)
  await db.run(sql`DROP TABLE \`solutions_blocks_divider\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_media_items\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_media_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_media\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_media_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_testimonial\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_testimonial_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_tabs_items\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_tabs_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_tabs\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_tabs_locales\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_spacer\`;`)
  await db.run(sql`DROP TABLE \`_solutions_v_blocks_divider\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_media_items\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_media_items_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_media\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_media_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_testimonial\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_testimonial_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_tabs_items\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_tabs_items_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_tabs\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_tabs_locales\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_spacer\`;`)
  await db.run(sql`DROP TABLE \`case_studies_blocks_divider\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_media_items\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_media_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_media\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_media_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_testimonial\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_testimonial_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_tabs_items\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_tabs_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_tabs\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_tabs_locales\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_spacer\`;`)
  await db.run(sql`DROP TABLE \`_case_studies_v_blocks_divider\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_media_items\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_media_items_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_media\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_media_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_testimonial\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_testimonial_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_tabs_items\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_tabs_items_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_tabs\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_tabs_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_spacer\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_divider\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_media_items\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_media_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_media\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_media_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_testimonial\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_testimonial_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_tabs_items\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_tabs_items_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_tabs\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_tabs_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_spacer\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_divider\`;`)
  // Drop only the added column: rebuilding hero tables cascades into existing locales/actions.
  await db.run(sql`DROP INDEX \`products_blocks_hero_video_idx\`;`)
  await db.run(sql`ALTER TABLE \`products_blocks_hero\` DROP COLUMN \`video_id\`;`)
  await db.run(sql`DROP INDEX \`_products_v_blocks_hero_video_idx\`;`)
  await db.run(sql`ALTER TABLE \`_products_v_blocks_hero\` DROP COLUMN \`video_id\`;`)
  await db.run(sql`DROP INDEX \`solutions_blocks_hero_video_idx\`;`)
  await db.run(sql`ALTER TABLE \`solutions_blocks_hero\` DROP COLUMN \`video_id\`;`)
  await db.run(sql`DROP INDEX \`_solutions_v_blocks_hero_video_idx\`;`)
  await db.run(sql`ALTER TABLE \`_solutions_v_blocks_hero\` DROP COLUMN \`video_id\`;`)
  await db.run(sql`DROP INDEX \`case_studies_blocks_hero_video_idx\`;`)
  await db.run(sql`ALTER TABLE \`case_studies_blocks_hero\` DROP COLUMN \`video_id\`;`)
  await db.run(sql`DROP INDEX \`_case_studies_v_blocks_hero_video_idx\`;`)
  await db.run(sql`ALTER TABLE \`_case_studies_v_blocks_hero\` DROP COLUMN \`video_id\`;`)
  await db.run(sql`DROP INDEX \`pages_blocks_hero_video_idx\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_hero\` DROP COLUMN \`video_id\`;`)
  await db.run(sql`DROP INDEX \`_pages_v_blocks_hero_video_idx\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_hero\` DROP COLUMN \`video_id\`;`)
}
