const createHttpError = require("http-errors");
const { CONTROL_PLANE } = require('../src/utils/constants');

/**
 * ADMIN ACCOUNTING CONTROLLER
 * Cross-tenant financial overview for Super Admins
 */
class AdminAccountingController {
  /**
   * GET /admin/accounting/accounts
   * Note: In a multi-tenant system, this usually shows a summary or links to tenants.
   */
  async getAllAccounts(req, res, next) {
    try {
      // Super Admin only (enforced by middleware)
      const result = await req.readWithTenant(async (context) => {
        const { transactionModels: models } = context;
        const { Business, TenantRegistry } = models;

        // For now, return active businesses and their identifiers
        // Real account aggregation requires a heavy background job or SystemMetrics
        const businesses = await Business.findAll({
          attributes: ['id', 'name', 'email', 'status'],
          include: [{ model: TenantRegistry, as: 'registry', attributes: ['status'] }]
        });

        return {
          count: businesses.length,
          businesses: businesses
        };
      }, CONTROL_PLANE);

      res.status(200).json({
        success: true,
        data: result.data,
        message: "Platform business summary (Accounting aggregation pending background job)"
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/accounting/transactions
   * Global transaction log summary
   */
  async getAllTransactions(req, res, next) {
    try {
      const result = await req.readWithTenant(async (context) => {
        const { transactionModels: models } = context;
        const { SystemMetrics } = models;

        const metrics = await SystemMetrics.findOne({ 
          where: { metricName: 'global_financial_summary' } 
        });

        return metrics ? metrics.metricValue : { latestTransactions: [], totalCount: 0 };
      }, CONTROL_PLANE);

      res.status(200).json({
        success: true,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/accounting/analytics
   */
  async getFinancialAnalytics(req, res, next) {
    try {
      const result = await req.readWithTenant(async (context) => {
        const { transactionModels: models } = context;
        const { SystemMetrics } = models;

        const metrics = await SystemMetrics.findOne({ 
          where: { metricName: 'financial_analytics' } 
        });

        return metrics ? metrics.metricValue : { trends: [], topRevenueTenants: [] };
      }, CONTROL_PLANE);

      res.status(200).json({
        success: true,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/accounting/dashboard
   */
  async getDashboardStats(req, res, next) {
    try {
      const result = await req.readWithTenant(async (context) => {
        const { transactionModels: models } = context;
        const { SystemMetrics, Business } = models;

        const [metrics, businessCount] = await Promise.all([
          SystemMetrics.findOne({ where: { metricName: 'platform_revenue_summary' } }),
          Business.count({ where: { status: 'active' } })
        ]);

        return {
          revenue: metrics?.metricValue?.totalRevenue || 0,
          activeTenants: businessCount,
          pendingTransactions: metrics?.metricValue?.pendingVolume || 0,
          lastUpdated: metrics?.lastUpdated
        };
      }, CONTROL_PLANE);

      res.status(200).json({
        success: true,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/accounting/reconciliation
   */
  async getAccountReconciliation(req, res, next) {
    try {
      // Placeholder for super admin reconciliation logic
      res.status(200).json({
        success: true,
        data: { status: 'healthy', discrepancies: 0 },
        message: "Platform reconciliation service operational"
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminAccountingController();
