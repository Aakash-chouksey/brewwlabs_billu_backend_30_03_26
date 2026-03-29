/**
 * TENANT HEALTH CHECK CONTROLLER
 * 
 * Provides health status and recovery capabilities for tenants
 */

const { sequelize } = require('../../config/unified_database');
const tenantModelLoader = require('../../src/architecture/tenantModelLoader');
const { TENANT_MODELS } = require('../../src/utils/constants');
const onboardingService = require('../../services/onboardingService');

const tenantHealthController = {
    /**
     * GET /tenant/health
     * Returns detailed health status of the tenant
     */
    getHealthStatus: async (req, res, next) => {
        try {
            const businessId = req.business_id || req.businessId;
            const schemaName = `tenant_${businessId}`;

            // Get tenant registry status
            const TenantRegistry = sequelize.models.TenantRegistry?.schema('public');
            const registry = await TenantRegistry?.findOne({
                where: { business_id: businessId },
                attributes: ['id', 'status', 'last_error', 'created_at', 'activated_at']
            });

            if (!registry) {
                return res.status(404).json({
                    success: false,
                    message: 'Tenant not found in registry'
                });
            }

            const registryData = registry.toJSON ? registry.toJSON() : registry;

            // Check schema exists
            const schemaResult = await sequelize.query(`
                SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema
            `, { 
                replacements: { schema: schemaName }, 
                type: sequelize.QueryTypes.SELECT 
            });
            const schemaExists = schemaResult.length > 0;

            // Get tables in schema
            let existingTables = [];
            let missingTables = [];
            
            if (schemaExists) {
                const tablesResult = await sequelize.query(`
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_schema = :schema AND table_type = 'BASE TABLE'
                `, { 
                    replacements: { schema: schemaName }, 
                    type: sequelize.QueryTypes.SELECT 
                });
                existingTables = tablesResult.map(t => t.table_name);

                // Check for required tables
                const requiredTables = ['outlets', 'products', 'orders', 'categories', 'inventory_items', 'settings'];
                missingTables = requiredTables.filter(t => !existingTables.includes(t));
            }

            // Determine overall status
            let healthStatus = 'unknown';
            if (registryData.status === 'active') {
                healthStatus = schemaExists && missingTables.length === 0 ? 'healthy' : 'degraded';
            } else if (registryData.status === 'INIT_FAILED') {
                healthStatus = 'failed';
            } else if (['CREATING', 'INIT_IN_PROGRESS'].includes(registryData.status)) {
                healthStatus = 'initializing';
            } else {
                healthStatus = registryData.status.toLowerCase();
            }

            return res.status(200).json({
                success: true,
                data: {
                    status: healthStatus,
                    registryStatus: registryData.status,
                    schemaExists,
                    tableCount: existingTables.length,
                    existingTables,
                    missingTables,
                    lastError: registryData.last_error,
                    createdAt: registryData.created_at,
                    activatedAt: registryData.activated_at,
                    canRecover: registryData.status === 'INIT_FAILED' && schemaExists
                }
            });

        } catch (error) {
            console.error('🚨 [TenantHealth] Error getting health status:', error.message);
            next(error);
        }
    },

    /**
     * POST /tenant/health/recover
     * Attempts to recover a failed tenant onboarding
     */
    recoverTenant: async (req, res, next) => {
        try {
            const businessId = req.business_id || req.businessId;
            const schemaName = `tenant_${businessId}`;

            // Get current registry status
            const TenantRegistry = sequelize.models.TenantRegistry?.schema('public');
            const registry = await TenantRegistry?.findOne({
                where: { business_id: businessId },
                attributes: ['status', 'retry_count', 'last_error']
            });

            if (!registry) {
                return res.status(404).json({
                    success: false,
                    message: 'Tenant not found in registry'
                });
            }

            const registryData = registry.toJSON ? registry.toJSON() : registry;

            // Only allow recovery for failed tenants
            if (registryData.status !== 'INIT_FAILED') {
                return res.status(400).json({
                    success: false,
                    message: `Cannot recover tenant with status: ${registryData.status}. Recovery only allowed for INIT_FAILED.`,
                    currentStatus: registryData.status
                });
            }

            // Check retry count
            const retryCount = registryData.retry_count || 0;
            const MAX_RETRIES = 3;
            
            if (retryCount >= MAX_RETRIES) {
                return res.status(429).json({
                    success: false,
                    message: 'Maximum recovery attempts reached. Please contact support.',
                    retryCount
                });
            }

            // Update retry count
            await TenantRegistry.update(
                { retry_count: retryCount + 1 },
                { where: { business_id: businessId } }
            );

            // Trigger background migration recovery
            setImmediate(() => {
                onboardingService._runBackgroundMigrations(schemaName, businessId, 3)
                    .then(result => {
                        console.log(`✅ [TenantRecovery] Recovery completed for ${businessId}:`, result);
                    })
                    .catch(err => {
                        console.error(`🚨 [TenantRecovery] Recovery failed for ${businessId}:`, err);
                    });
            });

            return res.status(202).json({
                success: true,
                message: 'Tenant recovery initiated. Background process started.',
                data: {
                    businessId,
                    schemaName,
                    previousRetries: retryCount,
                    maxRetries: MAX_RETRIES
                }
            });

        } catch (error) {
            console.error('🚨 [TenantHealth] Error recovering tenant:', error.message);
            next(error);
        }
    },

    /**
     * POST /tenant/health/validate
     * Validates schema integrity and returns detailed report
     */
    validateSchema: async (req, res, next) => {
        try {
            const businessId = req.business_id || req.businessId;
            const schemaName = `tenant_${businessId}`;

            // Run schema integrity verification
            const verification = await tenantModelLoader.verifySchemaIntegrity(sequelize, schemaName);

            return res.status(200).json({
                success: true,
                data: {
                    schemaName,
                    isValid: verification.isValid,
                    missingTables: verification.missingTables,
                    missingColumns: verification.missingColumns,
                    issueCount: verification.issues
                }
            });

        } catch (error) {
            console.error('🚨 [TenantHealth] Error validating schema:', error.message);
            next(error);
        }
    }
};

module.exports = tenantHealthController;
