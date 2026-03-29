const { sequelize } = require('../config/unified_database');

/**
 * SCHEMA VERSION HELPER
 * Utility to track and update tenant-specific schema versions.
 * Uses raw SQL for maximum compatibility and performance.
 */
class SchemaVersionHelper {
    /**
     * Get the current version of a tenant schema
     * @param {Object} models - Tenant bound models (or null to use raw SQL)
     * @param {string} schemaName - Schema name for raw SQL fallback
     * @returns {Promise<number>} - Current version (0 if not found)
     */
    async getTenantSchemaVersion(models, schemaName = null, sequelizeInstance = null, transaction = null) {
        try {
            const db = sequelizeInstance || sequelize;
            // Use raw SQL for reliability
            const targetSchema = schemaName || (models?.SchemaVersion?.options?.schema);
            if (!targetSchema) {
                console.warn('[SchemaVersionHelper] No schema specified, returning version 0');
                return 0;
            }

            const [result] = await db.query(
                `SELECT MAX(version) as max_version FROM "${targetSchema}"."schema_versions"`,
                { 
                    type: db.QueryTypes.SELECT,
                    transaction
                }
            );

            const version = result?.max_version || 0;
            console.log(`[SchemaVersionHelper] Schema ${targetSchema} is at version ${version}`);
            return version;
        } catch (error) {
            if (error.message.includes('does not exist')) {
                console.log(`[SchemaVersionHelper] schema_versions table missing in ${schemaName}, returning 0`);
                return 0;
            }
            console.error('[SchemaVersionHelper] ⚠️ Error getting version:', error.message);
            return 0;
        }
    }

    /**
     * Set/Update a tenant schema version
     * @param {Object} models - Tenant bound models
     * @param {number} version - Version to set
     * @param {Object} transaction - Optional sequelize transaction
     * @param {string} schemaName - Schema name for raw SQL
     * @returns {Promise<boolean>} - Success status
     */
    async setTenantSchemaVersion(models, version, transaction = null, schemaName = null, sequelizeInstance = null) {
        try {
            const db = sequelizeInstance || sequelize;
            const targetSchema = schemaName || (models?.SchemaVersion?.options?.schema);
            if (!targetSchema) {
                console.error('[SchemaVersionHelper] ❌ No schema specified');
                return false;
            }

            const query = `
                INSERT INTO "${targetSchema}"."schema_versions" (version, applied_at)
                VALUES (:version, NOW())
                ON CONFLICT (version) DO NOTHING
            `;

            const options = { 
                transaction, 
                replacements: { version } 
            };
            await db.query(query, options);

            console.log(`[SchemaVersionHelper] ✅ Set version ${version} for ${targetSchema}`);
            return true;
        } catch (error) {
            console.error(`[SchemaVersionHelper] ❌ Error setting version ${version}:`, error.message);
            return false;
        }
    }

    /**
     * Create schema_versions table if not exists
     * @param {string} schemaName - Target schema name
     * @returns {Promise<boolean>} - Success status
     */
    async ensureSchemaVersionsTable(schemaName, sequelizeInstance = null, transaction = null) {
        try {
            const db = sequelizeInstance || sequelize;
            await db.query(`
                CREATE TABLE IF NOT EXISTS "${schemaName}"."schema_versions" (
                    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    "business_id" UUID,
                    "version" INTEGER UNIQUE NOT NULL,
                    "migration_name" VARCHAR(255),
                    "description" TEXT,
                    "checksum" VARCHAR(64),
                    "applied_by" VARCHAR(100),
                    "applied_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            `, { transaction });
            console.log(`[SchemaVersionHelper] ✅ schema_versions table ensured for ${schemaName}`);
            return true;
        } catch (error) {
            console.error(`[SchemaVersionHelper] ❌ Failed to create schema_versions table:`, error.message);
            return false;
        }
    }
}

module.exports = new SchemaVersionHelper();
