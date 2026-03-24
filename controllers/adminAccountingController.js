/**
 * ADMIN ACCOUNTING CONTROLLER - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const createHttpError = require("http-errors");
const { QueryTypes } = require("sequelize");
const { CONTROL_PLANE } = require("../src/utils/constants");

const adminAccountingController = {
  // Get all accounts across all tenants
  getAllAccounts: async (req, res, next) => {
    try {
      if (req.auth.role !== "SUPER_ADMIN") {
        return next(createHttpError(403, "Super Admin access required"));
      }

      const { page = 1, limit = 50, businessId, outletId } = req.query;

      const result = await req.readWithTenant(async (context) => {
        const { sequelize, transaction } = context;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereConditions = [];
        let replacements = { limit: parseInt(limit), offset };

        if (businessId) {
          whereConditions.push("a.business_id = :businessId");
          replacements.businessId = businessId;
        }
        if (outletId) {
          whereConditions.push("a.outlet_id = :outletId");
          replacements.outletId = outletId;
        }

        const whereClause = whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

        const accounts = await sequelize.query(
          `SELECT a.*, b.name as "businessName", o.name as "outletName" 
           FROM accounts a 
           LEFT JOIN businesses b ON a.business_id = b.id 
           LEFT JOIN outlets o ON a.outlet_id = o.id 
           ${whereClause} 
           ORDER BY a.created_at DESC 
           LIMIT :limit OFFSET :offset`,
          { replacements, type: QueryTypes.SELECT, transaction }
        );

        const countResult = await sequelize.query(
          `SELECT COUNT(*) as total FROM accounts a ${whereClause}`,
          { replacements, type: QueryTypes.SELECT, transaction }
        );

        const total = parseInt(countResult[0]?.total) || 0;

        return { accounts, total, page: parseInt(page), limit: parseInt(limit) };
      }, CONTROL_PLANE);

      res.json({
        success: true,
        data: result.accounts,
        pagination: { ...result, totalPages: Math.ceil(result.total / result.limit) }
      });
    } catch (error) {
      next(error);
    }
  },

  // Get all transactions across all tenants
  getAllTransactions: async (req, res, next) => {
    try {
      if (req.auth.role !== "SUPER_ADMIN") {
        return next(createHttpError(403, "Super Admin access required"));
      }

      const { page = 1, limit = 50, businessId, outletId, type, startDate, endDate } = req.query;

      const result = await req.readWithTenant(async (context) => {
        const { sequelize, transaction } = context;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereConditions = ["1=1"];
        let replacements = { limit: parseInt(limit), offset };

        if (businessId) {
          whereConditions.push("t.business_id = :businessId");
          replacements.businessId = businessId;
        }
        if (outletId) {
          whereConditions.push("t.outlet_id = :outletId");
          replacements.outletId = outletId;
        }
        if (type && type !== "all") {
          whereConditions.push("t.type = :type");
          replacements.type = type;
        }
        if (startDate && endDate) {
          whereConditions.push("t.date BETWEEN :startDate AND :endDate");
          replacements.startDate = startDate;
          replacements.endDate = endDate;
        }

        const whereClause = whereConditions.join(" AND ");

        const transactions = await sequelize.query(
          `SELECT t.*, a.name as "accountName", b.name as "businessName", o.name as "outletName" 
           FROM transactions t 
           LEFT JOIN accounts a ON t.account_id = a.id 
           LEFT JOIN businesses b ON t.business_id = b.id 
           LEFT JOIN outlets o ON t.outlet_id = o.id 
           WHERE ${whereClause} 
           ORDER BY t.date DESC, t.created_at DESC 
           LIMIT :limit OFFSET :offset`,
          { replacements, type: QueryTypes.SELECT, transaction }
        );

        const countResult = await sequelize.query(
          `SELECT COUNT(*) as total FROM transactions t WHERE ${whereClause}`,
          { replacements, type: QueryTypes.SELECT, transaction }
        );

        const total = parseInt(countResult[0]?.total) || 0;

        return { transactions, total, page: parseInt(page), limit: parseInt(limit) };
      }, CONTROL_PLANE);

      res.json({
        success: true,
        data: result.transactions,
        pagination: { ...result, totalPages: Math.ceil(result.total / result.limit) }
      });
    } catch (error) {
      next(error);
    }
  },

  // Get cross-tenant financial analytics
  getFinancialAnalytics: async (req, res, next) => {
    try {
      if (req.auth.role !== "SUPER_ADMIN") {
        return next(createHttpError(403, "Super Admin access required"));
      }

      const { businessId, outletId, period = "month" } = req.query;

      const result = await req.readWithTenant(async (context) => {
        const { sequelize, transaction } = context;
        let dateFilter = "";
        if (period === "day") dateFilter = "AND date >= CURRENT_DATE";
        else if (period === "week") dateFilter = "AND date >= CURRENT_DATE - INTERVAL '7 days'";
        else if (period === "month") dateFilter = "AND date >= CURRENT_DATE - INTERVAL '30 days'";
        else if (period === "year") dateFilter = "AND date >= CURRENT_DATE - INTERVAL '365 days'";

        let whereConditions = ["1=1"];
        let replacements = {};
        if (businessId) {
          whereConditions.push("t.business_id = :businessId");
          replacements.businessId = businessId;
        }
        if (outletId) {
          whereConditions.push("t.outlet_id = :outletId");
          replacements.outletId = outletId;
        }

        const whereClause = whereConditions.join(" AND ");

        const [tenantSummary, transactionTrends, accountTypes] = await Promise.all([
          sequelize.query(
            `SELECT b.name as "businessName", o.name as "outletName", t.business_id, t.outlet_id, 
                    COUNT(*) as "transactionCount", 
                    SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END) as "totalCredits", 
                    SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END) as "totalDebits" 
             FROM transactions t 
             LEFT JOIN businesses b ON t.business_id = b.id 
             LEFT JOIN outlets o ON t.outlet_id = o.id 
             WHERE ${whereClause} ${dateFilter} 
             GROUP BY t.business_id, t.outlet_id, b.name, o.name 
             ORDER BY SUM(t.amount) DESC`,
            { replacements, type: QueryTypes.SELECT, transaction }
          ),
          sequelize.query(
            `SELECT DATE_TRUNC('day', t.date) as "period", COUNT(*) as "transactionCount", SUM(t.amount) as "netAmount" 
             FROM transactions t 
             WHERE ${whereClause} ${dateFilter} 
             GROUP BY DATE_TRUNC('day', t.date) 
             ORDER BY "period" DESC LIMIT 30`,
            { replacements, type: QueryTypes.SELECT, transaction }
          ),
          sequelize.query(
            `SELECT a.type, COUNT(*) as "accountCount", SUM(a.balance) as "totalBalance" 
             FROM accounts a 
             WHERE ${businessId ? "business_id = :businessId" : "1=1"} 
             GROUP BY a.type`,
            { replacements, type: QueryTypes.SELECT, transaction }
          )
        ]);

        return { tenantSummary, transactionTrends, accountTypes };
      }, CONTROL_PLANE);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = adminAccountingController;
