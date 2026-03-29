/**
 * SCHEMA VERSION ENFORCEMENT - Tenant Compatibility Validator
 * 
 * Enforces MIN_SUPPORTED_SCHEMA_VERSION across all tenants
 * Blocks API access if tenant is below required version
 */

const { Sequelize } = require('sequelize');
const config = require('../../config/config');

// ============================================
// CONFIGURATION - Adjust these values
// ============================================
const MIN_SUPPORTED_SCHEMA_VERSION = process.env.MIN_SCHEMA_VERSION || '2.0.0';
const VERSION_CHECK_ENABLED = process.env.SCHEMA_VERSION_CHECK !== 'false';

class SchemaVersionEnforcer {
    constructor(sequelize) {
        this.sequelize = sequelize;
        this.minVersion = this._parseVersion(MIN_SUPPORTED_SCHEMA_VERSION);
        this.cache = new Map();
        this.cacheTTL = 60000; // 1 minute cache
    }

    /**
     * Parse version string to comparable array
     */
    _parseVersion(version) {
        if (!version) return [0, 0, 0];
        const parts = version.split('.').map(Number);
        return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
    }

    /**
     * Compare two versions
     * Returns: -1 (a < b), 0 (a == b), 1 (a > b)
     */
    _compareVersions(a, b) {
        for (let i = 0; i < 3; i++) {
            if (a[i] < b[i]) return -1;
            if (a[i] > b[i]) return 1;
        }
        return 0;
    }

    /**
     * Format version for display
     */
    _formatVersion(version) {
        return `${version[0]}.${version[1]}.${version[2]}`;
    }

    /**
     * Get schema version for a tenant
     */
    async getTenantSchemaVersion(tenantSchema) {
        // Check cache
        const cached = this.cache.get(tenantSchema);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.version;
        }

        try {
            // Query schema_version table
            const [rows] = await this.sequelize.query(
                `SELECT version, updated_at FROM "${tenantSchema}".schema_versions ORDER BY updated_at DESC LIMIT 1`,
                { type: Sequelize.QueryTypes.SELECT }
            );

            let version = null;
            if (rows && rows.length > 0) {
                version = rows[0].version;
            } else {
                // Try alternative: check for presence of key tables
                version = await this._inferSchemaVersion(tenantSchema);
            }

            // Cache result
            this.cache.set(tenantSchema, {
                version,
                timestamp: Date.now()
            });

            return version;
        } catch (error) {
            // Schema might not exist yet
            return null;
        }
    }

    /**
     * Infer schema version by checking table existence
     */
    async _inferSchemaVersion(tenantSchema) {
        try {
            const [tables] = await this.sequelize.query(
                `SELECT table_name FROM information_schema.tables 
                 WHERE table_schema = :schema`,
                { 
                    replacements: { schema: tenantSchema },
                    type: Sequelize.QueryTypes.SELECT 
                }
            );

            if (!tables || tables.length === 0) {
                return null;
            }

            const tableNames = tables.map(t => t.table_name);

            // Version inference logic based on feature tables
            if (tableNames.includes('inventory_transactions')) {
                return '2.5.0'; // Advanced inventory
            } else if (tableNames.includes('recipes')) {
                return '2.3.0'; // Recipe management
            } else if (tableNames.includes('accounts')) {
                return '2.1.0'; // Accounting
            } else if (tableNames.includes('schema_versions')) {
                return '2.0.0'; // Base v2
            } else if (tableNames.includes('products')) {
                return '1.0.0'; // Legacy
            }

            return '0.0.0'; // Unknown/empty
        } catch (error) {
            return null;
        }
    }

    /**
     * Validate tenant is on supported version
     */
    async validateTenant(tenantSchema) {
        if (!VERSION_CHECK_ENABLED) {
            return { valid: true, checked: false };
        }

        const version = await this.getTenantSchemaVersion(tenantSchema);
        
        if (!version) {
            return {
                valid: false,
                error: 'SCHEMA_VERSION_UNKNOWN',
                message: `Cannot determine schema version for tenant: ${tenantSchema}`,
                action: 'MIGRATION_REQUIRED'
            };
        }

        const tenantVersion = this._parseVersion(version);
        const comparison = this._compareVersions(tenantVersion, this.minVersion);

        if (comparison < 0) {
            return {
                valid: false,
                error: 'SCHEMA_VERSION_OUTDATED',
                message: `Tenant schema version ${version} is below minimum ${MIN_SUPPORTED_SCHEMA_VERSION}`,
                currentVersion: version,
                minRequiredVersion: MIN_SUPPORTED_SCHEMA_VERSION,
                action: 'MIGRATION_REQUIRED',
                severity: 'BLOCKING'
            };
        }

        return {
            valid: true,
            version: version,
            minRequired: MIN_SUPPORTED_SCHEMA_VERSION,
            checked: true
        };
    }

    /**
     * Express middleware for API validation
     */
    middleware() {
        return async (req, res, next) => {
            const tenantSchema = req.tenantSchema || req.schema;
            
            if (!tenantSchema) {
                // No tenant context, skip validation
                return next();
            }

            const validation = await this.validateTenant(tenantSchema);

            if (!validation.valid) {
                console.error(`🚨 [SchemaVersion] Tenant ${tenantSchema} blocked: ${validation.message}`);
                
                return res.status(503).json({
                    success: false,
                    error: validation.error,
                    message: validation.message,
                    currentVersion: validation.currentVersion,
                    minRequiredVersion: validation.minRequiredVersion,
                    action: validation.action,
                    help: 'Contact administrator to run migrations for this tenant'
                });
            }

            // Attach version info to request
            req.schemaVersion = validation.version;
            next();
        };
    }

    /**
     * Batch validate multiple tenants
     */
    async validateAllTenants(tenantSchemas) {
        const results = await Promise.all(
            tenantSchemas.map(async (schema) => ({
                schema,
                ...(await this.validateTenant(schema))
            }))
        );

        return {
            total: results.length,
            valid: results.filter(r => r.valid).length,
            invalid: results.filter(r => !r.valid).length,
            results: results
        };
    }

    /**
     * Update schema version for tenant
     */
    async updateSchemaVersion(tenantSchema, version, migrationName = null) {
        try {
            await this.sequelize.query(
                `INSERT INTO "${tenantSchema}".schema_versions (version, migration_name, updated_at)
                 VALUES (:version, :migrationName, NOW())
                 ON CONFLICT (version) DO UPDATE SET 
                    updated_at = NOW(),
                    migration_name = EXCLUDED.migration_name`,
                {
                    replacements: { version, migrationName },
                    type: Sequelize.QueryTypes.INSERT
                }
            );

            // Invalidate cache
            this.cache.delete(tenantSchema);
            
            console.log(`✅ [SchemaVersion] Updated ${tenantSchema} to version ${version}`);
            return true;
        } catch (error) {
            console.error(`❌ [SchemaVersion] Failed to update ${tenantSchema}:`, error.message);
            return false;
        }
    }

    /**
     * Get enforcement status
     */
    getStatus() {
        return {
            minSupportedVersion: MIN_SUPPORTED_SCHEMA_VERSION,
            versionCheckEnabled: VERSION_CHECK_ENABLED,
            cacheSize: this.cache.size,
            cacheTTL: this.cacheTTL
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ [SchemaVersion] Cache cleared');
    }

    /**
     * Health check
     */
    async healthCheck(tenantSchema = null) {
        if (!tenantSchema) {
            return {
                status: 'unknown',
                config: this.getStatus()
            };
        }

        const validation = await this.validateTenant(tenantSchema);
        return {
            status: validation.valid ? 'healthy' : 'migration_required',
            ...validation
        };
    }
}

// Export singleton factory
let instance = null;

module.exports = {
    SchemaVersionEnforcer,
    getInstance: (sequelize) => {
        if (!instance && sequelize) {
            instance = new SchemaVersionEnforcer(sequelize);
        }
        return instance;
    },
    MIN_SUPPORTED_SCHEMA_VERSION
};
