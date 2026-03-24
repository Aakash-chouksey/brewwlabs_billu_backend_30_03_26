const tenantProvisionService = require('../services/tenantProvisionService');
const { Brand } = require('../../control_plane_models');

/**
 * Tenant Provisioning Controller
 * Handles HTTP requests for tenant management
 */
class TenantProvisionController {
    /**
     * Provision a new tenant
     * POST /api/admin/tenants
     */
    async provisionTenant(req, res) {
        try {
            const { brandName, ownerEmail, planId, clusterId } = req.body;
            
            // Validate required fields
            if (!brandName || !ownerEmail || !planId || !clusterId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: brandName, ownerEmail, planId, clusterId'
                });
            }

            // Get owner user ID from JWT
            const ownerUserId = req.user?.id;
            if (!ownerUserId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }

            const result = await tenantProvisionService.provisionTenant({
                brandName,
                ownerEmail,
                ownerUserId,
                planId,
                clusterId
            });

            res.status(201).json({
                success: true,
                data: result,
                message: 'Tenant provisioned successfully'
            });

        } catch (error) {
            console.error('Tenant provisioning error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Tenant provisioning failed'
            });
        }
    }

    /**
     * List all tenants
     * GET /api/admin/tenants
     */
    async listTenants(req, res) {
        try {
            const { status, type, page = 1, limit = 50 } = req.query;
            
            const filters = {};
            if (status) filters.status = status;
            if (type) filters.type = type;

            const tenants = await tenantProvisionService.listTenants(filters);

            // Apply pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedTenants = tenants.slice(startIndex, endIndex);

            res.json({
                success: true,
                data: {
                    tenants: paginatedTenants,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: tenants.length,
                        pages: Math.ceil(tenants.length / limit)
                    }
                }
            });

        } catch (error) {
            console.error('List tenants error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to list tenants'
            });
        }
    }

    /**
     * Get tenant details
     * GET /api/admin/tenants/:brandId
     */
    async getTenant(req, res) {
        try {
            const { brandId } = req.params;
            
            const stats = await tenantProvisionService.getTenantStats(brandId);

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Get tenant error:', error);
            res.status(404).json({
                success: false,
                message: error.message || 'Tenant not found'
            });
        }
    }

    /**
     * Test tenant connection
     * POST /api/admin/tenants/:brandId/test-connection
     */
    async testConnection(req, res) {
        try {
            const { brandId } = req.params;
            
            const result = await tenantProvisionService.testTenantConnection(brandId);

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Test connection error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Connection test failed'
            });
        }
    }

    /**
     * Update tenant status
     * PUT /api/admin/tenants/:brandId/status
     */
    async updateStatus(req, res) {
        try {
            const { brandId } = req.params;
            const { status } = req.body;
            
            if (!status) {
                return res.status(400).json({
                    success: false,
                    message: 'Status is required'
                });
            }

            const validStatuses = ['active', 'inactive', 'suspended', 'pending'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                });
            }

            const result = await tenantProvisionService.updateTenantStatus(brandId, status);

            res.json({
                success: true,
                data: result,
                message: 'Tenant status updated successfully'
            });

        } catch (error) {
            console.error('Update status error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to update tenant status'
            });
        }
    }

    /**
     * Deactivate tenant
     * DELETE /api/admin/tenants/:brandId
     */
    async deactivateTenant(req, res) {
        try {
            const { brandId } = req.params;
            
            const result = await tenantProvisionService.deactivateTenant(brandId);

            res.json({
                success: true,
                data: result,
                message: 'Tenant deactivated successfully'
            });

        } catch (error) {
            console.error('Deactivate tenant error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to deactivate tenant'
            });
        }
    }

    /**
     * Get tenant health metrics
     * GET /api/admin/tenants/:brandId/health
     */
    async getTenantHealth(req, res) {
        try {
            const { brandId } = req.params;
            
            const stats = await tenantProvisionService.getTenantStats(brandId);
            const connectionTest = await tenantProvisionService.testTenantConnection(brandId);

            // Calculate health score
            let healthScore = 100;
            let issues = [];

            if (!stats.brand || stats.brand.status !== 'active') {
                healthScore -= 30;
                issues.push('Brand is not active');
            }

            if (!connectionTest.success) {
                healthScore -= 50;
                issues.push('Database connection failed');
            }

            if (!stats.connection || !stats.connection.migrated) {
                healthScore -= 20;
                issues.push('Database not migrated');
            }

            const healthStatus = healthScore >= 80 ? 'healthy' : 
                               healthScore >= 60 ? 'warning' : 'critical';

            res.json({
                success: true,
                data: {
                    healthScore,
                    healthStatus,
                    issues,
                    brand: stats.brand,
                    connection: stats.connection,
                    database: connectionTest
                }
            });

        } catch (error) {
            console.error('Get tenant health error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to get tenant health'
            });
        }
    }

    /**
     * Get tenant migration logs
     * GET /api/admin/tenants/:brandId/migrations
     */
    async getMigrationLogs(req, res) {
        try {
            const { brandId } = req.params;
            const { page = 1, limit = 50 } = req.query;
            
            const { TenantMigrationLog } = require('../../control_plane_models');
            
            const logs = await TenantMigrationLog.findAndCountAll({
                where: { brand_id: brandId },
                order: [['executed_at', 'DESC']],
                limit: parseInt(limit),
                offset: (parseInt(page) - 1) * parseInt(limit)
            });

            res.json({
                success: true,
                data: {
                    logs: logs.rows,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: logs.count,
                        pages: Math.ceil(logs.count / limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get migration logs error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to get migration logs'
            });
        }
    }

    /**
     * Get tenant usage statistics
     * GET /api/admin/tenants/:brandId/usage
     */
    async getTenantUsage(req, res) {
        try {
            const { brandId } = req.params;
            
            // This would connect to tenant DB and get usage stats
            // For now, return placeholder data
            const usageStats = {
                users: 0,
                outlets: 0,
                products: 0,
                orders: 0,
                storage: {
                    used: 0,
                    limit: 1000 // MB
                },
                api: {
                    requests: 0,
                    limit: 10000
                }
            };

            res.json({
                success: true,
                data: usageStats
            });

        } catch (error) {
            console.error('Get tenant usage error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to get tenant usage'
            });
        }
    }
}

module.exports = new TenantProvisionController();
