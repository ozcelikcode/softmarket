import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`orders_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`edition_id\` integer,
  	\`sku\` text NOT NULL,
  	\`title\` text NOT NULL,
  	\`license_type\` text NOT NULL,
  	\`duration_months\` numeric,
  	\`seats\` numeric NOT NULL,
  	\`tax_mode\` text NOT NULL,
  	\`unit_net_minor\` numeric NOT NULL,
  	\`vat_rate_basis_points\` numeric NOT NULL,
  	\`vat_minor\` numeric NOT NULL,
  	\`line_total_minor\` numeric NOT NULL,
  	\`license_id\` integer,
  	FOREIGN KEY (\`edition_id\`) REFERENCES \`editions\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`license_id\`) REFERENCES \`licenses\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`orders_items_order_idx\` ON \`orders_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`orders_items_parent_id_idx\` ON \`orders_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`orders_items_edition_idx\` ON \`orders_items\` (\`edition_id\`);`)
  await db.run(sql`CREATE INDEX \`orders_items_license_idx\` ON \`orders_items\` (\`license_id\`);`)
  await db.run(sql`CREATE TABLE \`orders\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order_number\` text NOT NULL,
  	\`customer_id\` integer,
  	\`status\` text DEFAULT 'pending' NOT NULL,
  	\`currency\` text NOT NULL,
  	\`subtotal_minor\` numeric NOT NULL,
  	\`vat_minor\` numeric NOT NULL,
  	\`total_minor\` numeric NOT NULL,
  	\`provider\` text NOT NULL,
  	\`provider_env\` text,
  	\`provider_ref\` text,
  	\`provider_payment_id\` text,
  	\`idempotency_key\` text NOT NULL,
  	\`locale\` text DEFAULT 'tr',
  	\`paid_at\` text,
  	\`fulfilled_at\` text,
  	\`refunded_at\` text,
  	\`cancelled_at\` text,
  	\`failure_reason\` text,
  	\`billing_type\` text NOT NULL,
  	\`billing_name\` text NOT NULL,
  	\`billing_company\` text,
  	\`billing_identity_number\` text,
  	\`billing_tax_number\` text,
  	\`billing_tax_office\` text,
  	\`billing_email\` text NOT NULL,
  	\`billing_phone\` text,
  	\`billing_address_line\` text,
  	\`billing_district\` text,
  	\`billing_city\` text,
  	\`billing_postal_code\` text,
  	\`billing_country\` text DEFAULT 'TR',
  	\`consents_pre_information_version\` text,
  	\`consents_distance_sales_version\` text,
  	\`consents_digital_waiver_accepted\` integer DEFAULT false,
  	\`consents_accepted_at\` text,
  	\`consents_ip\` text,
  	\`consents_user_agent\` text,
  	\`consents_snapshot_sha256\` text,
  	\`contract_snapshot\` text,
  	\`requires_review\` integer DEFAULT false,
  	\`invoice_number\` text,
  	\`invoice_issued_at\` text,
  	\`invoice_note\` text,
  	\`notes\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`orders_order_number_idx\` ON \`orders\` (\`order_number\`);`)
  await db.run(sql`CREATE INDEX \`orders_customer_idx\` ON \`orders\` (\`customer_id\`);`)
  await db.run(sql`CREATE INDEX \`orders_status_idx\` ON \`orders\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`orders_provider_ref_idx\` ON \`orders\` (\`provider_ref\`);`)
  await db.run(sql`CREATE INDEX \`orders_provider_payment_id_idx\` ON \`orders\` (\`provider_payment_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`orders_idempotency_key_idx\` ON \`orders\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`orders_updated_at_idx\` ON \`orders\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`orders_created_at_idx\` ON \`orders\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`provider_providerRef_idx\` ON \`orders\` (\`provider\`,\`provider_ref\`);`)
  await db.run(sql`CREATE TABLE \`payment_events\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`provider\` text NOT NULL,
  	\`event_id\` text NOT NULL,
  	\`event_key\` text NOT NULL,
  	\`type\` text NOT NULL,
  	\`order_id\` integer,
  	\`signature_verified\` integer DEFAULT false,
  	\`body_sha256\` text NOT NULL,
  	\`status\` text DEFAULT 'received' NOT NULL,
  	\`failure_code\` text,
  	\`received_at\` text NOT NULL,
  	\`processed_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payment_events_event_key_idx\` ON \`payment_events\` (\`event_key\`);`)
  await db.run(sql`CREATE INDEX \`payment_events_order_idx\` ON \`payment_events\` (\`order_id\`);`)
  await db.run(sql`CREATE INDEX \`payment_events_status_idx\` ON \`payment_events\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`payment_events_received_at_idx\` ON \`payment_events\` (\`received_at\`);`)
  await db.run(sql`CREATE INDEX \`payment_events_updated_at_idx\` ON \`payment_events\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payment_events_created_at_idx\` ON \`payment_events\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`editions\` ADD \`sale_mode\` text DEFAULT 'quote';`)
  await db.run(sql`ALTER TABLE \`editions\` ADD \`pricing_tax_mode\` text DEFAULT 'inclusive';`)
  await db.run(sql`ALTER TABLE \`editions\` ADD \`pricing_try_minor\` numeric;`)
  await db.run(sql`ALTER TABLE \`editions\` ADD \`pricing_usd_minor\` numeric;`)
  await db.run(sql`ALTER TABLE \`editions\` ADD \`pricing_eur_minor\` numeric;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`orders_id\` integer REFERENCES orders(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`payment_events_id\` integer REFERENCES payment_events(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_orders_id_idx\` ON \`payload_locked_documents_rels\` (\`orders_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_payment_events_id_idx\` ON \`payload_locked_documents_rels\` (\`payment_events_id\`);`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`commerce_mode\` text DEFAULT 'quote-only';`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`commerce_providers_iyzico_enabled\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`commerce_providers_stripe_enabled\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`commerce_vat_try_rule\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`commerce_vat_try_rate_percent\` numeric;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`commerce_vat_try_rate_basis_points\` numeric;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`commerce_vat_usd_rule\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`commerce_vat_usd_rate_percent\` numeric;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`commerce_vat_usd_rate_basis_points\` numeric;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`commerce_vat_eur_rule\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`commerce_vat_eur_rate_percent\` numeric;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`commerce_vat_eur_rate_basis_points\` numeric;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`commerce_quote_since\` text;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  /*
   * Safe down (hand-written; the generated one rebuilt payload_locked_documents_rels through a copy table and dropped sales data):
   *  1. refuses (throws, changes nothing) while any order, payment event or lock on them exists — sales data is kept;
   *  2. otherwise removes exactly what up() added: lock columns (index first), new tables, editions/site_settings columns.
   * No table rebuild, no DELETE: every pre-existing row stays as it was.
   */
  const count = async (query: string) => Number(((await db.all<{ n: number }>(sql.raw(query)))[0] ?? { n: 0 }).n)
  const rows = await count('SELECT (SELECT COUNT(*) FROM orders) + (SELECT COUNT(*) FROM payment_events) + (SELECT COUNT(*) FROM payload_locked_documents_rels WHERE orders_id IS NOT NULL OR payment_events_id IS NOT NULL) AS n')
  if (rows > 0) throw new Error('p2_payments_commerce down refused: orders/payment events exist (sales records are never deleted).')
  const configured = await count(`SELECT (SELECT COUNT(*) FROM editions WHERE sale_mode IS NOT 'quote' OR pricing_tax_mode IS NOT 'inclusive' OR pricing_try_minor IS NOT NULL OR pricing_usd_minor IS NOT NULL OR pricing_eur_minor IS NOT NULL) + (SELECT COUNT(*) FROM site_settings WHERE commerce_mode IS NOT 'quote-only' OR commerce_providers_iyzico_enabled IS NOT 0 OR commerce_providers_stripe_enabled IS NOT 0 OR commerce_vat_try_rule IS NOT NULL OR commerce_vat_try_rate_percent IS NOT NULL OR commerce_vat_try_rate_basis_points IS NOT NULL OR commerce_vat_usd_rule IS NOT NULL OR commerce_vat_usd_rate_percent IS NOT NULL OR commerce_vat_usd_rate_basis_points IS NOT NULL OR commerce_vat_eur_rule IS NOT NULL OR commerce_vat_eur_rate_percent IS NOT NULL OR commerce_vat_eur_rate_basis_points IS NOT NULL OR commerce_quote_since IS NOT NULL) AS n`)
  if (configured > 0) throw new Error('p2_payments_commerce down refused: commerce configuration exists.')
  await db.run(sql`DROP INDEX \`payload_locked_documents_rels_orders_id_idx\`;`)
  await db.run(sql`DROP INDEX \`payload_locked_documents_rels_payment_events_id_idx\`;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`orders_id\`;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`payment_events_id\`;`)
  await db.run(sql`DROP TABLE \`payment_events\`;`)
  await db.run(sql`DROP TABLE \`orders_items\`;`)
  await db.run(sql`DROP TABLE \`orders\`;`)
  for (const column of ['sale_mode', 'pricing_tax_mode', 'pricing_try_minor', 'pricing_usd_minor', 'pricing_eur_minor']) {
    await db.run(sql.raw(`ALTER TABLE \`editions\` DROP COLUMN \`${column}\`;`))
  }
  const vat = ['try', 'usd', 'eur'].flatMap((c) => [`commerce_vat_${c}_rule`, `commerce_vat_${c}_rate_percent`, `commerce_vat_${c}_rate_basis_points`])
  for (const column of ['commerce_mode', 'commerce_providers_iyzico_enabled', 'commerce_providers_stripe_enabled', ...vat, 'commerce_quote_since']) {
    await db.run(sql.raw(`ALTER TABLE \`site_settings\` DROP COLUMN \`${column}\`;`))
  }
}
