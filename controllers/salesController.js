/**
 * NEON-SAFE ARCHITECTURE COMPLIANCE
 * 
 * This controller follows the standardized high-performance architecture:
 * - Models accessed via context.models (READ) or context.transactionModels (WRITE)
 * - req.models is DEPRECATED and blocked by middleware to prevent connection pinning.
 * - All DB calls MUST use req.readWithTenant() or req.executeWithTenant().
 */

const salesService = require('../services/tenant/sales.service');

/**
 * Sales Controller
 */
const getDashboardMetrics = async (req, res, next) => {
    try {
        const metrics = await salesService.getDashboardMetrics(req);
        res.status(200).json({ success: true, data: metrics });
    } catch (error) {
        next(error);
    }
};

const getDailySales = async (req, res, next) => {
    try {
        const data = await salesService.getDailySales(req);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const getItemSales = async (req, res, next) => {
    try {
        const data = await salesService.getItemSales(req);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const getCategorySales = async (req, res, next) => {
    try {
        const data = await salesService.getCategorySales(req);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const getPaymentSummary = async (req, res, next) => {
    try {
        const data = await salesService.getPaymentSummary(req);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getDashboardMetrics,
    getDailySales,
    getItemSales,
    getCategorySales,
    getPaymentSummary,
    // Aliases for tenant.routes.js
    getSalesDashboard: getDashboardMetrics,
    getPaymentSales: getPaymentSummary
};
