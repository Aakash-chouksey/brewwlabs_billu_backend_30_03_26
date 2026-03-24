/**
 * COMPREHENSIVE TENANT ROUTES
 * ===========================
 * 
 * All tenant-specific routes mounted with Neon-safe middleware.
 * NEON-SAFE: Models are accessed via context (req.executeWithTenant or req.readWithTenant).
 * req.models is DEPRECATED and removed in Phase 10.
 */

const express = require('express');
const router = express.Router();

// ==========================================
// PROFILE ROUTES
// ==========================================
const profileController = require('../../controllers/tenant/profileController');
router.get('/profile', profileController.getProfile);
router.put('/profile', profileController.updateProfile);

// ==========================================
// TABLE ROUTES
// ==========================================
const tableController = require('../../controllers/tableController');
router.get('/tables', tableController.getTables);
router.post('/tables', tableController.addTable);
router.put('/tables/:id', tableController.updateTable);
router.delete('/tables/:id', tableController.deleteTable);

// ==========================================
// AREA ROUTES
// ==========================================
const areaController = require('../../controllers/areaController');
router.get('/areas', areaController.getAreas);
router.post('/areas', areaController.addArea);
router.put('/areas/:id', areaController.updateArea);
router.delete('/areas/:id', areaController.deleteArea);

// ==========================================
// OPERATION TIMING ROUTES
// ==========================================
const timingController = require('../../controllers/tenant/timingController');
router.get('/operation-timings', timingController.getTimings);
router.post('/operation-timings', timingController.createTiming);
router.put('/operation-timings/:id', timingController.updateTiming);
router.delete('/operation-timings/:id', timingController.deleteTiming);

// ==========================================
// OUTLET ROUTES
// ==========================================
const outletController = require('../../controllers/tenant/outletController');
router.get('/outlets', outletController.getOutlets);
router.post('/outlets', outletController.createOutlet);
router.put('/outlets/:id', outletController.updateOutlet);

// ==========================================
// PAYMENT ROUTES
// ==========================================
const paymentController = require('../../controllers/paymentController');
router.post('/payments/create-order', paymentController.createOrder);
router.post('/payments/verify', paymentController.verifyPayment);

// ==========================================
// ORDER ROUTES
// ==========================================
const orderController = require('../../controllers/orderController');
router.get('/orders', orderController.getOrders);
router.post('/orders', orderController.addOrder);
router.get('/orders/archived', orderController.getArchivedOrders);
router.get('/orders/:id', orderController.getOrderById);
router.put('/orders/:id', orderController.updateOrder);

// ==========================================
// E-BILL ROUTES
// ==========================================
const ebillController = require('../../controllers/ebillController');
router.post('/ebill/send', ebillController.sendEBill);

// ==========================================
// SALES/REPORT ROUTES
// ==========================================
const salesController = require('../../controllers/salesController');
router.get('/sales/daily', salesController.getDailySales);
router.get('/sales/categories', salesController.getCategorySales);
router.get('/sales/items', salesController.getItemSales);
router.get('/sales/payments', salesController.getPaymentSales);
router.get('/sales/dashboard', salesController.getSalesDashboard);

// ==========================================
// DASHBOARD ROUTES
// ==========================================
const dashboardController = require('../../controllers/dashboardController');
router.get('/dashboard', dashboardController.getDashboardStats);

// ==========================================
// PURCHASE ROUTES
// ==========================================
const purchaseController = require('../../controllers/tenant/purchaseController');
router.get('/purchases', purchaseController.getPurchases);
router.post('/purchases', purchaseController.addPurchase);

// ==========================================
// INVENTORY SALE ROUTES
// ==========================================
const inventorySaleController = require('../../controllers/inventorySaleController');
router.get('/inventory-sales', inventorySaleController.getInventorySales);
router.post('/inventory-sales', inventorySaleController.addInventorySale);

// ==========================================
// INVENTORY ITEM ROUTES
// ==========================================
const inventoryController = require('../../controllers/inventoryController');
router.get('/inventory/items', inventoryController.getInventoryItems);
router.post('/inventory/items', inventoryController.addInventoryItem);
router.put('/inventory/items/:id', inventoryController.updateInventoryItem);
router.delete('/inventory/items/:id', inventoryController.deleteInventoryItem);

// ==========================================
// INVENTORY CATEGORY ROUTES
// ==========================================
const inventoryCategoryController = require('../../controllers/inventoryCategoryController');
router.get('/inventory-categories', inventoryCategoryController.getCategories);
router.post('/inventory-categories', inventoryCategoryController.addCategory);
router.put('/inventory-categories/:id', inventoryCategoryController.updateCategory);
router.delete('/inventory-categories/:id', inventoryCategoryController.deleteCategory);
router.put('/inventory-categories/:id/status', inventoryCategoryController.toggleStatus);

// ==========================================
// RECIPE ROUTES
// ==========================================
const recipeController = require('../../controllers/recipeController');
router.get('/recipes', recipeController.getRecipes);
router.post('/recipes', recipeController.addRecipe);
router.get('/recipes/:id', recipeController.getRecipeById);
router.put('/recipes/:id', recipeController.updateRecipe);
router.delete('/recipes/:id', recipeController.deleteRecipe);
router.get('/recipes/:id/availability', recipeController.checkAvailability);
router.get('/recipes/:id/cost-analysis', recipeController.getCostAnalysis);

// ==========================================
// WASTAGE ROUTES
// ==========================================
const wastageController = require('../../controllers/tenant/wastageController');
router.get('/inventory/wastage', wastageController.getWastageRecords);
router.post('/inventory/wastage', wastageController.addWastageRecord);
router.delete('/inventory/wastage/:id', wastageController.deleteWastageRecord);

// ==========================================
// STOCK ADJUSTMENT ROUTES
// ==========================================
const stockController = require('../../controllers/tenant/stockController');
router.post('/inventory/purchase', stockController.purchaseStock);
router.post('/inventory/self-consume', stockController.selfConsumeStock);
router.post('/inventory/adjust', stockController.adjustStock);
router.get('/inventory/adjustments', stockController.getAdjustments);
router.post('/inventory/adjustments', stockController.createAdjustment);
router.get('/inventory/transactions', stockController.getTransactions);
router.get('/inventory/low-stock', stockController.getLowStockItems);

// ==========================================
// SUPPLIER ROUTES
// ==========================================
const supplierController = require('../../controllers/tenant/supplierController');
router.get('/inventory/suppliers', supplierController.getSuppliers);
router.post('/inventory/suppliers', supplierController.addSupplier);
router.put('/inventory/suppliers/:id', supplierController.updateSupplier);
router.delete('/inventory/suppliers/:id', supplierController.deleteSupplier);

// ==========================================
// STAFF/USERS ROUTES
// ==========================================
const staffController = require('../../controllers/tenant/staffController');
router.get('/users', staffController.getUsers);
router.post('/users', staffController.createStaff);

// ==========================================
// TIMING ROUTES
// ==========================================
const businessTimingController = require('../../controllers/tenant/businessTimingController');
router.get('/timing', businessTimingController.getTimings);
router.post('/timing', businessTimingController.createTiming);

// ==========================================
// PRODUCT TYPE ROUTES
// ==========================================
const productTypeController = require('../../controllers/productTypeController');
router.get('/product-types', productTypeController.getProductTypes);
router.post('/product-types', productTypeController.createProductType);

// ==========================================
// EXPENSE TYPE ROUTES
// ==========================================
const expenseTypeController = require('../../controllers/expenseTypeController');
router.get('/expense-types', expenseTypeController.getExpenseTypes);
router.post('/expense-types', expenseTypeController.createExpenseType);
router.put('/expense-types/:id', expenseTypeController.updateExpenseType);
router.delete('/expense-types/:id', expenseTypeController.deleteExpenseType);

// ==========================================
// TABLES MANAGEMENT ROUTES
// ==========================================
const tableManagementController = require('../../controllers/tenant/tableManagementController');
router.get('/tables-management', tableManagementController.getTables);
router.post('/tables-management', tableManagementController.createTable);
router.put('/tables-management/:id', tableManagementController.updateTable);
router.delete('/tables-management/:id', tableManagementController.deleteTable);

// ==========================================
// LIVE FEEDING ROUTES
// ==========================================
const liveController = require('../../controllers/tenant/liveController');
router.get('/live-orders', liveController.getLiveOrders);
router.get('/live-stats', liveController.getLiveStats);

// ==========================================
// CONTROL CENTER ROUTES
// ==========================================
const controlCenterController = require('../../controllers/tenant/controlCenterController');
router.get('/control-center', controlCenterController.getStats);
router.get('/system-health', controlCenterController.getSystemHealth);

// ==========================================
// BILLING CONFIG ROUTES
// ==========================================
const billingConfigController = require('../../controllers/tenant/billingConfigController');
router.get('/billing/config', billingConfigController.getConfig);
router.put('/billing/config', billingConfigController.updateConfig);
router.patch('/billing/config', billingConfigController.patchConfig);

// ==========================================
// BUSINESS ROUTES
// ==========================================
const businessController = require('../../controllers/tenant/businessController');
router.get('/business', businessController.getBusinessInfo);
router.put('/business', businessController.updateBusinessInfo);

// ==========================================
// CATEGORY ROUTES (using existing controller)
// ==========================================
const categoryController = require('../../controllers/tenant/category.controller');
router.get('/categories', categoryController.getCategories);
router.post('/categories', categoryController.addCategory);
router.put('/categories/:id', categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);

// ==========================================
// PRODUCT ROUTES
// ==========================================
const productController = require('../../controllers/productController');
router.get('/products', productController.getProducts);
router.post('/products', productController.addProduct);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

module.exports = router;
