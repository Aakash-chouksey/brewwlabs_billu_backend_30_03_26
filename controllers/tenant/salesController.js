/**
 * SALES CONTROLLER - Neon-Safe Version
 * Standardized for transaction-scoped service access and consistent multi-tenancy.
 */

const salesService = require('../../services/tenant/sales.service');

/**
 * Sales Controller
 */
const getDashboardMetrics = async (req, res, next) => {
    try {
        const metrics = await salesService.getDashboardMetrics(req);
        res.status(200).json({ 
            success: true, 
            data: metrics,
            message: "Dashboard metrics retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

const getDailySales = async (req, res, next) => {
    try {
        const data = await salesService.getDailySales(req);
        res.status(200).json({ 
            success: true, 
            data: data,
            message: "Daily sales data retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

const getItemSales = async (req, res, next) => {
    try {
        const data = await salesService.getItemSales(req);
        res.status(200).json({ 
            success: true, 
            data: data,
            message: "Item sales data retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

const getCategorySales = async (req, res, next) => {
    try {
        const data = await salesService.getCategorySales(req);
        res.status(200).json({ 
            success: true, 
            data: data,
            message: "Category sales data retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

const getPaymentSummary = async (req, res, next) => {
    try {
        const data = await salesService.getPaymentSummary(req);
        res.status(200).json({ 
            success: true, 
            data: data,
            message: "Payment summary retrieved successfully"
        });
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
    // Aliases for route compatibility
    getSalesDashboard: getDashboardMetrics,
    getPaymentSales: getPaymentSummary
};
