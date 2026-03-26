/**
 * UNIFIED TENANT SERVICE
 * 
 * Provides centralized tenant validation and management
 * CRITICAL: All tenant lookups must go through this service
 */

const { controlPlaneSequelize } = require('../config/control_plane_db');
const neonTransactionSafeExecutor = require('./neonTransactionSafeExecutor');
const { TENANT_TYPES } = require('../domains/domain.config');

class UnifiedTenantService {
    constructor() {
        this.tenantCache = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Validate tenant exists and is accessible
     * @param {string} tenantId - Tenant identifier (businessId/brandId)
     * @returns {Promise<{valid: boolean, tenant?: object, error?: string}>}
     */
    async validateTenant(tenantId) {
        try {
            if (!tenantId) {
                return { valid: false, error: 'Tenant ID is required' };
            }

            // Check cache first
            const cached = this.tenantCache.get(tenantId);
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                console.log(`✅ Tenant ${tenantId} validated from cache`);
                return { valid: true, tenant: cached.data };
            }

            // Use transaction-safe executor to validate tenant
            const result = await neonTransactionSafeExecutor.readWithTenant(
                TENANT_TYPES.CONTROL_PLANE, 
                async (transaction) => {
                    const getBusinessModel = require('../models/businessModel');
                    const Business = getBusinessModel(controlPlaneSequelize);
                    
                    const tenant = await Business.findOne({
                        where: { id: tenantId },
                        attributes: ['id', 'name', 'email', 'status', 'isActive', 'type'],
                        transaction
                    });

                    if (!tenant) {
                        return { found: false };
                    }

                    return { 
                        found: true, 
                        tenant: tenant.toJSON(),
                        isActive: tenant.isActive !== false && tenant.status !== 'SUSPENDED'
                    };
                }
            );

            if (!result.success || !result.data?.found) {
                console.warn(`⚠️ Tenant ${tenantId} not found`);
                return { valid: false, error: 'Tenant not found' };
            }

            const tenantData = result.data;

            if (!tenantData.isActive) {
                console.warn(`⚠️ Tenant ${tenantId} is inactive or suspended`);
                return { valid: false, error: 'Tenant is not active' };
            }

            // Cache successful validation
            this.tenantCache.set(tenantId, {
                data: tenantData.tenant,
                timestamp: Date.now()
            });

            console.log(`✅ Tenant ${tenantId} validated successfully`);
            return { valid: true, tenant: tenantData.tenant };

        } catch (error) {
            console.error(`❌ Tenant validation error for ${tenantId}:`, error.message);
            return { valid: false, error: 'Tenant validation failed' };
        }
    }

    /**
     * Get tenant by ID
     * @param {string} tenantId - Tenant identifier
     * @returns {Promise<object|null>}
     */
    async getTenant(tenantId) {
        const validation = await this.validateTenant(tenantId);
        return validation.valid ? validation.tenant : null;
    }

    /**
     * Clear tenant from cache
     * @param {string} tenantId - Tenant identifier
     */
    invalidateCache(tenantId) {
        this.tenantCache.delete(tenantId);
        console.log(`🗑️ Tenant ${tenantId} removed from cache`);
    }

    /**
     * Clear all cache
     */
    invalidateAllCache() {
        this.tenantCache.clear();
        console.log('🗑️ All tenant cache cleared');
    }

    /**
     * Check if tenant is active
     * @param {string} tenantId - Tenant identifier
     * @returns {Promise<boolean>}
     */
    async isTenantActive(tenantId) {
        const validation = await this.validateTenant(tenantId);
        return validation.valid;
    }
}

// Export singleton
module.exports = new UnifiedTenantService();
