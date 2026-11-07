import * as migration_20261106_145404_initial_sqlite from './20261106_145404_initial_sqlite';
import * as migration_20261106_150000_sqlite_integrity from './20261106_150000_sqlite_integrity';
import * as migration_20261106_151826_remove_online_sales from './20261106_151826_remove_online_sales';
import * as migration_20261106_161413_portal_security_consent from './20261106_161413_portal_security_consent';
import * as migration_20261106_164616_phase8a_content_mcp from './20261106_164616_phase8a_content_mcp';
import * as migration_20261106_165449_phase8a_media_identity from './20261106_165449_phase8a_media_identity';
import * as migration_20261107_092304_remove_sales_legal_fields from './20261107_092304_remove_sales_legal_fields';

export const migrations = [
  {
    up: migration_20261106_145404_initial_sqlite.up,
    down: migration_20261106_145404_initial_sqlite.down,
    name: '20261106_145404_initial_sqlite',
  },
  {
    up: migration_20261106_150000_sqlite_integrity.up,
    down: migration_20261106_150000_sqlite_integrity.down,
    name: '20261106_150000_sqlite_integrity',
  },
  {
    up: migration_20261106_151826_remove_online_sales.up,
    down: migration_20261106_151826_remove_online_sales.down,
    name: '20261106_151826_remove_online_sales',
  },
  {
    up: migration_20261106_161413_portal_security_consent.up,
    down: migration_20261106_161413_portal_security_consent.down,
    name: '20261106_161413_portal_security_consent',
  },
  {
    up: migration_20261106_164616_phase8a_content_mcp.up,
    down: migration_20261106_164616_phase8a_content_mcp.down,
    name: '20261106_164616_phase8a_content_mcp',
  },
  {
    up: migration_20261106_165449_phase8a_media_identity.up,
    down: migration_20261106_165449_phase8a_media_identity.down,
    name: '20261106_165449_phase8a_media_identity',
  },
  {
    up: migration_20261107_092304_remove_sales_legal_fields.up,
    down: migration_20261107_092304_remove_sales_legal_fields.down,
    name: '20261107_092304_remove_sales_legal_fields'
  },
];
