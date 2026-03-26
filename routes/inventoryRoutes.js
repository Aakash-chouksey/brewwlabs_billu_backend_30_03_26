/**
 * FIXED INVENTORY API ROUTES
 * 
 * This file consolidates and fixes all inventory-related routes
 * following proper architecture and middleware chain.
 */

const express = require('express');
const router = express.Router();
const createHttpError = require('http-errors');

// Import controllers that follow proper architecture
const inventoryController = require('../controllers/inventoryController');
const inventoryCategoryController = require('../controllers/inventoryCategoryController');
const inventoryDashboardController = require('../controllers/inventoryDashboardController');
const recipeController = require('../controllers/recipeController');

// Import services for direct route handlers
const inventoryService = require('../services/inventoryService');

// ==================== INVENTORY ITEMS ====================

// Get all inventory items
router.get('/items', inventoryController.getItems);

// Create new inventory item  
router.post('/items', inventoryController.addItem);

// Update inventory item
router.put('/items/:id', inventoryController.updateItem);

// Delete inventory item
router.delete('/items/:id', inventoryController.deleteItem);

// ==================== INVENTORY CATEGORIES ====================

// Get all categories
router.get('/categories', inventoryCategoryController.getCategories);

// Create category
router.post('/categories', inventoryCategoryController.addCategory);

// Update category
router.put('/categories/:id', inventoryCategoryController.updateCategory);

// Delete category
router.delete('/categories/:id', inventoryCategoryController.deleteCategory);

// ==================== STOCK MANAGEMENT ====================

// Purchase stock (add inventory)
router.post('/purchase', inventoryController.addPurchase);

// Self consumption
router.post('/self-consume', inventoryController.addSelfConsume);

// Record wastage
router.post('/wastage', inventoryController.addWastage);

// Stock adjustment
router.post('/adjust', inventoryController.adjustStock);

// 🔥 ALIASES for user testing
router.post('/add', inventoryController.addItem);
router.post('/transaction', inventoryController.adjustStock);

// ==================== TRANSACTIONS ====================

// Get inventory transactions
router.get('/transactions', inventoryController.getTransactions);

// Update transaction
router.put('/transactions/:id', inventoryController.updateTransaction);

// Delete transaction
router.delete('/transactions/:id', inventoryController.deleteTransaction);

// ==================== LOW STOCK ====================

// Get low stock items
router.get('/low-stock', inventoryController.getLowStock);

// ==================== DASHBOARD ====================

// Get inventory dashboard summary
router.get('/dashboard/summary', inventoryDashboardController.getDashboardSummary);

// ==================== RECIPES ====================

// Get all recipes
router.get('/recipes', recipeController.getRecipes);

// Create recipe
router.post('/recipes', recipeController.createRecipe);

// Get single recipe
router.get('/recipes/:id', recipeController.getRecipe);

// Update recipe
router.put('/recipes/:id', recipeController.updateRecipe);

// Delete recipe
router.delete('/recipes/:id', recipeController.deleteRecipe);

// Check recipe availability
router.get('/recipes/:id/availability', recipeController.checkAvailability);

// Get recipe cost analysis
router.get('/recipes/:id/cost-analysis', recipeController.getCostAnalysis);

// ==================== ORDER VALIDATION ====================

// Check if product can be prepared
router.get('/check-availability/:productId', async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { quantity = 1 } = req.query;
        const { businessId, outletId } = req;

        if (!businessId || !outletId) {
            throw createHttpError(400, "Business ID and Outlet ID are required");
        }

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            return await inventoryService.canPrepareProduct(
                models, 
                productId, 
                parseInt(quantity), 
                businessId, 
                outletId
            );
        });

        res.status(200).json({ success: true, data: result.data });
    } catch (error) {
        next(error);
    }
});

// Check order availability (multiple products)
router.post('/check-order-availability', async (req, res, next) => {
    try {
        const { orderItems } = req.body;
        const { businessId, outletId } = req;

        if (!orderItems || !Array.isArray(orderItems)) {
            return res.status(400).json({ 
                success: false, 
                message: "Order items array is required" 
            });
        }

        if (!businessId || !outletId) {
            throw createHttpError(400, "Business ID and Outlet ID are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            return await inventoryService.checkOrderAvailability(
                models, 
                orderItems, 
                businessId, 
                outletId
            );
        });

        res.status(200).json({ success: true, data: result.data });
    } catch (error) {
        next(error);
    }
});

// Deduct inventory for sale (single product)
router.post('/deduct/:productId', async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { quantity, orderId } = req.body;
        const { businessId, outletId } = req;

        if (!quantity || quantity <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Valid quantity is required" 
            });
        }

        if (!businessId || !outletId) {
            throw createHttpError(400, "Business ID and Outlet ID are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            return await inventoryService.deductInventoryForSale(
                models, 
                productId, 
                parseInt(quantity), 
                orderId, 
                businessId, 
                outletId, 
                req.auth?.id
            );
        });

        res.status(200).json({ success: true, data: result.data });
    } catch (error) {
        next(error);
    }
});

// Deduct inventory for order (multiple products)
router.post('/deduct-order', async (req, res, next) => {
    try {
        const { orderItems, orderId } = req.body;
        const { businessId, outletId } = req;

        if (!orderItems || !Array.isArray(orderItems)) {
            return res.status(400).json({ 
                success: false, 
                message: "Order items array is required" 
            });
        }

        if (!orderId) {
            return res.status(400).json({ 
                success: false, 
                message: "Order ID is required" 
            });
        }

        if (!businessId || !outletId) {
            throw createHttpError(400, "Business ID and Outlet ID are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            return await inventoryService.deductInventoryForOrder(
                models, 
                orderItems, 
                orderId, 
                businessId, 
                outletId, 
                req.auth?.id
            );
        });

        res.status(200).json({ success: true, data: result.data });
    } catch (error) {
        next(error);
    }
});

// ==================== REPORTS ====================

// Get consumption report
router.get('/reports/consumption', async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        const { businessId, outletId } = req;

        if (!businessId || !outletId) {
            throw createHttpError(400, "Business ID and Outlet ID are required");
        }

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            return await inventoryService.getConsumptionReport(
                models, 
                businessId, 
                outletId, 
                startDate, 
                endDate
            );
        });

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
});

// Get low stock alerts
router.get('/reports/low-stock-alerts', async (req, res, next) => {
    try {
        const { businessId, outletId } = req;

        if (!businessId || !outletId) {
            throw createHttpError(400, "Business ID and Outlet ID are required");
        }

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            return await inventoryService.getLowStockAlerts(
                models, 
                businessId, 
                outletId
            );
        });

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
});

// Get inventory value report
router.get('/reports/inventory-value', async (req, res, next) => {
    try {
        const { businessId, outletId } = req;

        if (!businessId || !outletId) {
            throw createHttpError(400, "Business ID and Outlet ID are required");
        }

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            return await inventoryService.getInventoryValueReport(
                models, 
                businessId, 
                outletId
            );
        });

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
