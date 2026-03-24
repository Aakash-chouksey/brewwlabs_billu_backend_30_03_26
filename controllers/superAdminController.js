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

            res.json(result);
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
                    where: { businessId: tenantId },
                    include: [{ model: Business, as: 'business' }]
                });
            }, CONTROL_PLANE);

            if (!result) throw new Error('Tenant not found');

            res.json(result);
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
                return await TenantRegistry.findOne({ where: { businessId: tenantId } });
            }, CONTROL_PLANE);

            if (!exists) throw new Error('Tenant not found');

            // Securely access tenant-specific data
            const orders = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Order } = models;
                return await Order.findAll({ 
                    limit: 50, 
                    order: [['created_at', 'DESC']]
                });
            }, tenantId);

            res.json(orders);
        } catch (error) {
            next(error);
        }
    }

    /**
     * PATCH /admin/tenants/:tenantId/status
     * Suspend or activate a tenant.
     */
    async updateTenantStatus(req, res, next) {
        try {
            const { tenantId } = req.params;
            const { status } = req.body;

            if (!['active', 'suspended'].includes(status)) {
                throw new Error('Invalid status');
            }

            await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { TenantRegistry, Business } = models;

                const registry = await TenantRegistry.findOne({ where: { businessId: tenantId }, transaction });
                if (!registry) throw new Error('Tenant not found');

                await registry.update({ status }, { transaction });
                
                const business = await Business.findOne({ where: { id: tenantId }, transaction });
                if (business) {
                    await business.update({ status: status === 'active' ? 'active' : 'inactive' }, { transaction });
                }
            }, CONTROL_PLANE);

            res.json({ success: true, message: `Tenant status updated to ${status}` });
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
                    message: "Metrics are being calculated. Check back in 15 minutes.",
                    isPending: true
                });
            }

            res.json({
                ...metrics.metricValue,
                lastUpdated: metrics.lastUpdated
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new SuperAdminController();
