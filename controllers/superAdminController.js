/**
 * Super Admin Controller - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const { CONTROL_PLANE } = require('../src/utils/constants');

class SuperAdminController {
    /**
     * GET /admin/tenants
     * List all registered tenants with their status.
     */
    async getAllTenants(req, res, next) {
        try {
            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { TenantRegistry, Business } = models;

                return await TenantRegistry.findAll({
                    include: [{ model: Business, as: 'business', attributes: ['id', 'name', 'email', 'status'] }]
                });
            }, CONTROL_PLANE);

            const data = result.data || result;
            res.json({
                success: true,
                data: data,
                message: "Tenants retrieved successfully"
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /admin/tenants/:tenantId
     * Get detailed info for a specific tenant.
     */
    async getTenantDetails(req, res, next) {
        try {
            const { tenantId } = req.params;
            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { TenantRegistry, Business } = models;

                return await TenantRegistry.findOne({
                    where: { business_id: tenantId },
                    include: [{ model: Business, as: 'business' }]
                });
            }, CONTROL_PLANE);

            const data = result.data || result;
            if (!data) throw new Error('Tenant not found');

            res.json({
                success: true,
                data: data,
                message: "Tenant details retrieved successfully"
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /admin/tenants/:tenantId/orders
     * Example of cross-tenant data access: Get orders for a specific tenant.
     */
    async getTenantOrders(req, res, next) {
        try {
            const { tenantId } = req.params;
            
            // Verify tenant exists first
            const exists = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { TenantRegistry } = models;
                return await TenantRegistry.findOne({ where: { business_id: tenantId } });
            }, CONTROL_PLANE);

            if (!exists) throw new Error('Tenant not found');

            const orders = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Order } = models;
                return await Order.findAll({ 
                    limit: 50, 
                    order: [['created_at', 'DESC']]
                });
            }, tenantId);

            res.json({
                success: true,
                data: orders.data || orders,
                message: "Tenant orders retrieved successfully"
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * PATCH /admin/tenants/:tenantId/status
     * Approve, suspend or activate a tenant.
     * Supports: onboarding → active (approval), active → suspended, suspended → active
     */
    async updateTenantStatus(req, res, next) {
        try {
            const { tenantId } = req.params;
            const { status } = req.body;

            // Allow onboarding → active for approval workflow
            const validStatuses = ['active', 'suspended', 'onboarding'];
            if (!validStatuses.includes(status)) {
                throw new Error('Invalid status. Must be: active, suspended, or onboarding');
            }

            const result = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { TenantRegistry, Business, User } = models;

                const registry = await TenantRegistry.findOne({ where: { business_id: tenantId }, transaction });
                if (!registry) throw new Error('Tenant not found');

                const oldStatus = registry.status;
                await registry.update({ status }, { transaction });
                
                const business = await Business.findOne({ where: { id: tenantId }, transaction });
                if (business) {
                    const isClosing = status === 'suspended';
                    const businessStatus = status === 'active' ? 'active' : 'inactive';
                    await business.update({ status: businessStatus }, { transaction });
                    
                    // Cascade status to users
                    if (status === 'active') {
                        await User.update(
                            { status: 'ACTIVE', isActive: true, isVerified: true },
                            { where: { businessId: tenantId }, transaction }
                        );
                    } else if (isClosing) {
                        await User.update(
                            { isActive: false },
                            { where: { businessId: tenantId }, transaction }
                        );
                    }
                }

                return { oldStatus, newStatus: status, businessName: business?.name };
            }, CONTROL_PLANE);

            res.json({ 
                success: true, 
                message: `Tenant ${result.data?.businessName || tenantId} status updated from "${result.data?.oldStatus}" to "${status}"`,
                data: result.data
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /admin/tenants/pending
     * Get all tenants awaiting approval (onboarding status)
     */
    async getPendingTenants(req, res, next) {
        try {
            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { TenantRegistry, Business } = models;

                return await TenantRegistry.findAll({
                    where: { status: 'onboarding' },
                    include: [{ 
                        model: Business, 
                        as: 'registryBusiness', 
                        attributes: ['id', 'name', 'email', 'phone', 'status', 'created_at'] 
                    }]
                });
            }, CONTROL_PLANE);

            res.json({ 
                success: true, 
                count: result.data?.length || 0,
                data: result.data 
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /admin/tenants/search?email=aakash@gmail.com
     * Search tenants by business email
     */
    async searchTenantByEmail(req, res, next) {
        try {
            const { email } = req.query;
            
            if (!email) {
                throw new Error('Email query parameter is required');
            }

            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { TenantRegistry, Business } = models;

                // Find business by email first
                const business = await Business.findOne({
                    where: { email },
                    attributes: ['id', 'name', 'email', 'phone', 'status', 'createdAt']
                });

                if (!business) {
                    return null;
                }

                // Get registry entry for this business
                const registry = await TenantRegistry.findOne({
                    where: { business_id: business.id },
                    attributes: ['status', 'schema_name', 'created_at']
                });

                return { business, registry };
            }, CONTROL_PLANE);

            if (!result) {
                return res.status(404).json({ 
                    success: false, 
                    message: `No tenant found with email: ${email}` 
                });
            }

            res.json({ 
                success: true, 
                data: {
                    businessId: result.data?.business?.id,
                    name: result.data?.business?.name,
                    email: result.data?.business?.email,
                    status: result.data?.registry?.status || 'unknown',
                    schemaName: result.data?.registry?.schemaName,
                    createdAt: result.data?.business?.createdAt
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /admin/metrics
     */
    async getSystemMetrics(req, res, next) {
        try {
            const metrics = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { SystemMetrics } = models;
                return await SystemMetrics.findOne({ where: { metricName: 'global_summary' } });
            }, CONTROL_PLANE);

            if (!metrics) {
                return res.json({
                    success: true,
                    message: "Metrics are being calculated. Check back in 15 minutes.",
                    data: { isPending: true }
                });
            }

            res.json({
                success: true,
                message: "System metrics retrieved successfully",
                data: {
                    ...metrics.metricValue,
                    lastUpdated: metrics.lastUpdated
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /admin/dashboard
     * Dashboard statistics for super admin
     */
    async getPlatformStats(req, res, next) {
        return this.getSystemMetrics(req, res, next);
    }

    /**
     * GET /admin/businesses
     * Alias for getAllTenants
     */
    async getBusinesses(req, res, next) {
        return this.getAllTenants(req, res, next);
    }

    /**
     * POST /admin/businesses/:id/status
     */
    async updateBusinessStatus(req, res, next) {
        req.params.tenantId = req.params.id;
        return this.updateTenantStatus(req, res, next);
    }

    /**
     * POST /admin/businesses/:id/approve
     */
    async approveBusiness(req, res, next) {
        try {
            req.params.tenantId = req.params.id;
            req.body.status = 'active';
            return this.updateTenantStatus(req, res, next);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generic Not Implemented Handler
     */
    async notImplemented(req, res, next) {
        res.status(501).json({
            success: false,
            message: `Endpoint ${req.method} ${req.originalUrl} is not yet implemented in the Neon-safe architecture.`,
            data: null
        });
    }
}

module.exports = new SuperAdminController();
