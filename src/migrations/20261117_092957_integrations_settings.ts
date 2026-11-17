import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`integrations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`iyzico_environment\` text DEFAULT 'sandbox' NOT NULL,
  	\`stripe_environment\` text DEFAULT 'sandbox' NOT NULL,
  	\`smtp_host\` text,
  	\`smtp_port\` numeric DEFAULT 587,
  	\`smtp_secure\` integer DEFAULT false,
  	\`smtp_user\` text,
  	\`smtp_from_address\` text,
  	\`smtp_from_name\` text,
  	\`secrets\` text,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`ALTER TABLE \`pages_locales\` ADD \`legal_review_approved_by\` text;`)
  await db.run(sql`ALTER TABLE \`pages_locales\` ADD \`legal_review_approved_at\` text;`)
  await db.run(sql`ALTER TABLE \`pages_locales\` ADD \`legal_review_approved_hash\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_locales\` ADD \`version_legal_review_approved_by\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_locales\` ADD \`version_legal_review_approved_at\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_locales\` ADD \`version_legal_review_approved_hash\` text;`)
  await db.run(sql`ALTER TABLE \`site_settings\` ADD \`company_etbis_no\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Never discard entered settings: encrypted keys / SMTP, lawyer approvals or the ETBIS number.
  const [integrations, approvals, etbis] = await Promise.all([
    db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM integrations WHERE secrets IS NOT NULL OR smtp_host IS NOT NULL OR smtp_user IS NOT NULL
      OR smtp_from_address IS NOT NULL OR smtp_from_name IS NOT NULL OR smtp_port IS NOT 587 OR smtp_secure IS NOT 0
      OR iyzico_environment <> 'sandbox' OR stripe_environment <> 'sandbox'`),
    db.all<{ n: number }>(sql`SELECT (SELECT COUNT(*) FROM pages_locales WHERE legal_review_approved_by IS NOT NULL OR legal_review_approved_at IS NOT NULL OR legal_review_approved_hash IS NOT NULL)
      + (SELECT COUNT(*) FROM _pages_v_locales WHERE version_legal_review_approved_by IS NOT NULL OR version_legal_review_approved_at IS NOT NULL OR version_legal_review_approved_hash IS NOT NULL) AS n`),
    db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM site_settings WHERE company_etbis_no IS NOT NULL AND company_etbis_no <> ''`),
  ])
  if (Number(integrations[0]?.n) > 0 || Number(approvals[0]?.n) > 0 || Number(etbis[0]?.n) > 0) {
    throw new Error('integrations_settings down refused: integration settings, legal approvals or ETBIS data exist.')
  }
  await db.run(sql`DROP TABLE \`integrations\`;`)
  await db.run(sql`ALTER TABLE \`pages_locales\` DROP COLUMN \`legal_review_approved_by\`;`)
  await db.run(sql`ALTER TABLE \`pages_locales\` DROP COLUMN \`legal_review_approved_at\`;`)
  await db.run(sql`ALTER TABLE \`pages_locales\` DROP COLUMN \`legal_review_approved_hash\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_locales\` DROP COLUMN \`version_legal_review_approved_by\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_locales\` DROP COLUMN \`version_legal_review_approved_at\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_locales\` DROP COLUMN \`version_legal_review_approved_hash\`;`)
  await db.run(sql`ALTER TABLE \`site_settings\` DROP COLUMN \`company_etbis_no\`;`)
}
