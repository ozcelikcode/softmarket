import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // SQLite cannot drop columns used by table-level foreign keys. Rebuild only the
  // affected tables; preserve license document locks across ON DELETE cascades.
  await db.run(sql`DROP TABLE orders_items`)
  await db.run(sql`DROP TABLE orders_webhook_events`)
  await db.run(sql`CREATE TEMP TABLE saved_license_locks AS SELECT * FROM payload_locked_documents_rels`)
  for (const [table, removedColumn] of [
    ['licenses', 'order_id'],
    ['payload_locked_documents_rels', 'orders_id'],
  ]) {
    const rows = await db.all<{ sql: string }>(sql.raw(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`))
    const indexes = await db.all<{ sql: string }>(sql.raw(`SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='${table}' AND sql IS NOT NULL AND name NOT IN ('licenses_order_idx', 'payload_locked_documents_rels_orders_id_idx')`))
    const columns = (await db.all<{ name: string }>(sql.raw(`PRAGMA table_info("${table}")`)))
      .map(({ name }) => name).filter((name) => name !== removedColumn)
      .map((name) => `"${name}"`).join(', ')
    const definition = rows[0].sql.split('\n')
      .filter((line) => !line.includes(`\`${removedColumn}\``) && !line.includes(`"${removedColumn}"`))
      .join('\n').replace(/,\s*\)$/, '\n)')
      .replace(/CREATE TABLE [^(]+/, `CREATE TABLE "__new_${table}" `)
    await db.run(sql.raw(definition))
    const source = table === 'licenses' ? table : 'saved_license_locks'
    await db.run(sql.raw(`INSERT INTO "__new_${table}" (${columns}) SELECT ${columns} FROM "${source}"`))
    await db.run(sql.raw(`DROP TABLE "${table}"`))
    await db.run(sql.raw(`ALTER TABLE "__new_${table}" RENAME TO "${table}"`))
    for (const index of indexes) await db.run(sql.raw(index.sql))
  }
  await db.run(sql`DROP TABLE saved_license_locks`)
  await db.run(sql`DROP TABLE orders`)
  await db.run(sql`ALTER TABLE \`customers\` DROP COLUMN \`billing_address_line1\`;`)
  await db.run(sql`ALTER TABLE \`customers\` DROP COLUMN \`billing_address_line2\`;`)
  await db.run(sql`ALTER TABLE \`customers\` DROP COLUMN \`billing_address_district\`;`)
  await db.run(sql`ALTER TABLE \`customers\` DROP COLUMN \`billing_address_city\`;`)
  await db.run(sql`ALTER TABLE \`customers\` DROP COLUMN \`billing_address_postal_code\`;`)
  await db.run(sql`ALTER TABLE \`customers\` DROP COLUMN \`billing_address_country\`;`)
  await db.run(sql`ALTER TABLE \`editions\` DROP COLUMN \`prices_try\`;`)
  await db.run(sql`ALTER TABLE \`editions\` DROP COLUMN \`prices_usd\`;`)
  await db.run(sql`ALTER TABLE \`editions\` DROP COLUMN \`prices_eur\`;`)
  await db.run(sql`ALTER TABLE \`editions\` DROP COLUMN \`vat_rate\`;`)
  await db.run(sql`ALTER TABLE \`editions\` DROP COLUMN \`purchasable\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`commerce_checkout_enabled\`;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
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
  await db.run(sql`ALTER TABLE \`customers\` ADD \`billing_address_line1\` text;`)
  await db.run(sql`ALTER TABLE \`customers\` ADD \`billing_address_line2\` text;`)
  await db.run(sql`ALTER TABLE \`customers\` ADD \`billing_address_district\` text;`)
  await db.run(sql`ALTER TABLE \`customers\` ADD \`billing_address_city\` text;`)
  await db.run(sql`ALTER TABLE \`customers\` ADD \`billing_address_postal_code\` text;`)
  await db.run(sql`ALTER TABLE \`customers\` ADD \`billing_address_country\` text DEFAULT 'TR';`)
  await db.run(sql`ALTER TABLE \`editions\` ADD \`prices_try\` numeric;`)
  await db.run(sql`ALTER TABLE \`editions\` ADD \`prices_usd\` numeric;`)
  await db.run(sql`ALTER TABLE \`editions\` ADD \`prices_eur\` numeric;`)
  await db.run(sql`ALTER TABLE \`editions\` ADD \`vat_rate\` numeric DEFAULT 20;`)
  await db.run(sql`ALTER TABLE \`editions\` ADD \`purchasable\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`licenses\` ADD \`order_id\` integer REFERENCES orders(id);`)
  await db.run(sql`CREATE INDEX \`licenses_order_idx\` ON \`licenses\` (\`order_id\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`orders_id\` integer REFERENCES orders(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_orders_id_idx\` ON \`payload_locked_documents_rels\` (\`orders_id\`);`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`commerce_checkout_enabled\` integer DEFAULT false;`)
}
