/**
 * SCHEMA VERSIONING AND LOCK
 * 
 * Version: v1_final
 * Date: 2026-03-20
 * 
 * This file locks the schema version. No direct schema edits are allowed after this.
 * All future changes must go through the migration system.
 */

module.exports = {
    SCHEMA_VERSION: 'v1_final',
    LOCKED: true,
    LAST_MIGRATION: 'v1_final_standardization.sql'
};
