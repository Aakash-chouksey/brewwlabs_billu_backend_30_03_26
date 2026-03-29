const fs = require('fs');
const path = require('path');
const schemaVersionHelper = require('../../utils/schemaVersionHelper');
const { sequelize } = require('../../config/unified_database');

/**
 * MIGRATION RUNNER
 * Handles the execution of tenant-specific schema migrations.
 * ENHANCED: Uses raw SQL for version tracking to prevent duplicate execution.
 */
class MigrationRunner {
    constructor() {
        this.migrationsPath = path.join(__dirname, '../../migrations/tenant');
    }

    /**
     * Get current schema version using raw SQL
     * @param {string} schemaName - Target schema name
     * @returns {Promise<number>} - Current version
     */
    async getCurrentVersion(sequelizeInstance, schemaName, transaction = null) {
        try {
            const query = `SELECT MAX(version) as max_version FROM "${schemaName}"."schema_versions"`;
            const options = { 
                type: sequelizeInstance.QueryTypes.SELECT,
                transaction
            };
            const [result] = await sequelizeInstance.query(query, options);
            return result?.max_version || 0;
        } catch (error) {
            if (error.message.includes('does not exist')) {
                // Table doesn't exist, create it using helper
                await schemaVersionHelper.ensureSchemaVersionsTable(schemaName, sequelizeInstance, transaction);
                return 0;
            }
            console.error(`[MigrationRunner] ❌ Error getting version for ${schemaName}:`, error.message);
            return 0;
        }
    }

    /**
     * Record migration version using raw SQL with ON CONFLICT
     * @param {Object} sequelizeInstance - Sequelize instance
     * @param {string} schemaName - Target schema name
     * @param {number} version - Version to record
     * @param {Object} transaction - Active transaction
     */
    async recordVersion(sequelizeInstance, schemaName, version, transaction = null) {
        try {
            const id = require('crypto').randomUUID();
            await sequelizeInstance.query(
                `INSERT INTO "${schemaName}"."schema_versions" (id, version, applied_at, created_at, updated_at)
                 VALUES (:id, :version, NOW(), NOW(), NOW())
                 ON CONFLICT (version) DO NOTHING`,
                { 
                    replacements: { id, version },
                    transaction 
                }
            );
            console.log(`[MigrationRunner] ✅ Recorded version ${version} for ${schemaName}`);
        } catch (error) {
            console.error(`[MigrationRunner] ❌ Failed to record version ${version}:`, error.message);
            throw error;
        }
    }

    /**
     * Run all pending migrations for a given schema
     * @param {Object} sequelizeInstance - Sequelize instance
     * @param {string} schemaName - Target schema name
     * @param {Object} tenantModels - Bound tenant models
     * @param {string} customPath - Optional custom migration path
     */
    async runPendingMigrations(sequelizeInstance, schemaName, tenantModels, customPath = null) {
        const runnerStartTime = Date.now();
        const migrationsPath = customPath || this.migrationsPath;
        console.log(`[MigrationRunner] Checking for pending migrations in ${migrationsPath} for schema: ${schemaName}`);
        
        const migrationTimings = [];
        
        try {
            // 1. Get current version using raw SQL
            console.time('⏱️ [Timing] Get current schema version');
            const currentVersion = await this.getCurrentVersion(sequelizeInstance, schemaName);
            console.timeEnd('⏱️ [Timing] Get current schema version');
            console.log(`[MigrationRunner] Current version for ${schemaName}: ${currentVersion}`);

            // 2. Load and filter migration files (.js and .sql)
            const files = fs.readdirSync(migrationsPath)
                .filter(file => file.endsWith('.js') || file.endsWith('.sql'))
                .sort();

            let migrationsRun = 0;

            for (const file of files) {
                let migration;
                let version;
                let description;
                let isSql = file.endsWith('.sql');

                // Extract version from filename (v1_..., v2_..., or 001_...)
                const versionMatch = file.match(/^(v|0+)(\d+)/i);
                if (!versionMatch) {
                    console.warn(`[MigrationRunner] ⚠️ Skipping file with invalid naming: ${file}`);
                    continue;
                }
                version = parseInt(versionMatch[2]);
                description = file.replace(/^(v|0+)\d+_?/, '').replace(/\.(js|sql)$/, '').replace(/_/g, ' ');

                // CRITICAL: Skip if already at or beyond this version
                if (version <= currentVersion) {
                    console.log(`[MigrationRunner] ⏭️ Skipping v${version} (already applied)`);
                    continue;
                }
                
                const migrationStartTime = Date.now();
                console.log(`[MigrationRunner] Applying migration v${version}: ${description}`);
                console.time(`⏱️ [Timing] Migration v${version}`);
                
                // Double-check version hasn't changed (race condition protection)
                const checkVersion = await this.getCurrentVersion(sequelizeInstance, schemaName);
                if (checkVersion >= version) {
                    console.log(`[MigrationRunner] ⏭️ Skipping v${version} (applied by another process)`);
                    continue;
                }
                
                try {
                    if (isSql) {
                        const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
                        // ALWAYS use a transaction for migrations to ensure search_path consistency
                        const transaction = await sequelizeInstance.transaction();
                        const options = { transaction };
                        
                        try {
                            // 🔒 CRITICAL: Set search_path to the specific schema for this migration
                            await sequelizeInstance.query(`SET search_path TO "${schemaName}"`, options);
                            
                            await sequelizeInstance.query(sql, options);
                            await this.recordVersion(sequelizeInstance, schemaName, version, transaction);
                            
                            await transaction.commit();
                        } catch (error) {
                            await transaction.rollback();
                            throw error;
                        }
                    } else {
                        const absPath = path.join(migrationsPath, file);
                        console.log(`[MigrationRunner] 🔍 Loading JS migration from: ${absPath}`);
                        
                        // 🧹 CRITICAL: Clear cache to ensure latest file is used (crucial for local dev/retries)
                        if (require.cache[absPath]) {
                            delete require.cache[absPath];
                        }
                        
                        migration = require(absPath);
                        const migVersion = migration.version || version;
                        
                        const transaction = await sequelizeInstance.transaction();
                        
                        try {
                            // 🔒 CRITICAL: Set search_path to the specific schema for this migration
                            await sequelizeInstance.query(`SET search_path TO "${schemaName}"`, { transaction });
                            
                            await migration.up(sequelizeInstance, schemaName, tenantModels, transaction);
                            await this.recordVersion(sequelizeInstance, schemaName, migVersion, transaction);
                            
                            await transaction.commit();
                        } catch (error) {
                            if (transaction) await transaction.rollback();
                            throw error;
                        }
                    }
                    
                    const migrationDuration = Date.now() - migrationStartTime;
                    migrationTimings.push({ version, duration: migrationDuration });
                    migrationsRun++;
                    console.timeEnd(`⏱️ [Timing] Migration v${version}`);
                    console.log(`[MigrationRunner] ✅ Successfully applied v${version} to ${schemaName} in ${migrationDuration}ms`);
                } catch (error) {
                    console.error(`[MigrationRunner] ❌ Failed to apply v${version} to ${schemaName}:`, error.message);
                    throw error;
                }
            }

            const totalDuration = Date.now() - runnerStartTime;
            console.log(`[MigrationRunner] 🎉 Finished migrations for ${schemaName} in ${totalDuration}ms (${migrationsRun} migrations run)`);
            
            if (migrationTimings.length > 0) {
                console.log(`[MigrationRunner] ⏱️ Migration timing summary:`);
                migrationTimings.forEach(t => {
                    console.log(`  - v${t.version}: ${t.duration}ms`);
                });
            }
        } catch (error) {
            console.error(`[MigrationRunner] 🚨 Error running migrations for ${schemaName}:`, error.message);
            throw error;
        }
    }
}

module.exports = new MigrationRunner();
