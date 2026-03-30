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
const { wrapController } = require('../../middlewares/safeControllerWrapper');

const tenantStatusController = wrapController(require('../../controllers/tenant/tenantStatusController'));
const accountingController = wrapController(require('../../controllers/tenant/accountingController'));
const profileController = wrapController(require('../../controllers/tenant/profileController'));
const tableController = wrapController(require('../../controllers/tenant/tableController'));
const areaController = wrapController(require('../../controllers/tenant/areaController'));
const businessTimingController = wrapController(require('../../controllers/tenant/businessTimingController'));
const outletController = wrapController(require('../../controllers/tenant/outletController'));
const paymentController = wrapController(require('../../controllers/tenant/paymentController'));
const orderController = wrapController(require('../../controllers/tenant/orderController'));
const settlementController = wrapController(require('../../controllers/tenant/settlementController'));
const ebillController = wrapController(require('../../controllers/tenant/ebillController'));
const salesController = wrapController(require('../../controllers/tenant/salesController'));
const reportController = wrapController(require('../../controllers/tenant/reportController'));
const dashboardController = wrapController(require('../../controllers/tenant/dashboardController'));
const analyticsController = wrapController(require('../../controllers/tenant/analyticsController'));
const purchaseController = wrapController(require('../../controllers/tenant/purchaseController'));
const inventorySaleController = wrapController(require('../../controllers/tenant/inventorySaleController'));
const inventoryDashboardController = wrapController(require('../../controllers/tenant/inventoryDashboardController'));
const inventoryController = wrapController(require('../../controllers/tenant/inventoryController'));
const inventoryCategoryController = wrapController(require('../../controllers/tenant/inventoryCategoryController'));
const recipeController = wrapController(require('../../controllers/tenant/recipeController'));
const rollTrackingController = wrapController(require('../../controllers/tenant/rollTrackingController'));
const kitchenController = wrapController(require('../../controllers/tenant/kitchenController'));
const whatsappController = wrapController(require('../../controllers/tenant/whatsappController'));
const wastageController = wrapController(require('../../controllers/tenant/wastageController'));
const stockController = wrapController(require('../../controllers/tenant/stockController'));
const supplierController = wrapController(require('../../controllers/tenant/supplierController'));
const staffController = wrapController(require('../../controllers/tenant/staffController'));
const productTypeController = wrapController(require('../../controllers/tenant/productTypeController'));
const expenseTypeController = wrapController(require('../../controllers/tenant/expenseTypeController'));
const tableManagementController = wrapController(require('../../controllers/tenant/tableManagementController'));
const liveController = wrapController(require('../../controllers/tenant/liveController'));
const controlCenterController = wrapController(require('../../controllers/tenant/controlCenterController'));
const billingConfigController = wrapController(require('../../controllers/tenant/billingConfigController'));
const businessController = wrapController(require('../../controllers/tenant/businessController'));
const categoryController = wrapController(require('../../controllers/tenant/category.controller'));
const productController = wrapController(require('../../controllers/tenant/productController'));
const tenantHealthController = wrapController(require('../../controllers/tenant/tenantHealthController'));
const userController = wrapController(require('../../controllers/tenant/userController'));
const { uploadSingle } = require('../../src/utils/imageUpload');

// ==========================================
// SYSTEM/STATUS ROUTES (High Priority)
// ==========================================
router.get('/status', tenantStatusController.getStatus);

// ==========================================
// ACCOUNTING ROUTES
// ==========================================
router.get('/accounting/accounts', accountingController.getAccounts);
router.post('/accounting/accounts', accountingController.createAccount);
// Note: updateAccount and deleteAccount not yet implemented in controller
// router.put('/accounting/accounts/:id', accountingController.updateAccount);
// router.delete('/accounting/accounts/:id', accountingController.deleteAccount);

// Accounting Transactions
router.get('/accounting/transactions', accountingController.getTransactions);
router.post('/accounting/transactions', accountingController.addTransaction);

// ==========================================
// PROFILE ROUTES
// ==========================================
router.get('/profile', profileController.getProfile);
router.put('/profile', profileController.updateProfile);

// ==========================================
// TABLE ROUTES
// ==========================================
router.get('/tables', tableController.getTables);
router.post('/tables', tableController.addTable);
router.put('/tables/:id', tableController.updateTable);
router.delete('/tables/:id', tableController.deleteTable);

// ==========================================
// AREA ROUTES
// ==========================================
router.get('/areas', areaController.getAreas);
router.post('/areas', areaController.addArea);
router.put('/areas/:id', areaController.updateArea);
router.delete('/areas/:id', areaController.deleteArea);

// ==========================================
// OPERATION TIMING ROUTES
// ==========================================
router.get('/operation-timings', businessTimingController.getTimings);
router.post('/operation-timings', businessTimingController.createTiming);
// router.get('/timing', businessTimingController.getTimings); // Legacy alias

// ==========================================
// OUTLET ROUTES
// ==========================================
router.get('/outlets', outletController.getOutlets);
router.post('/outlets', outletController.createOutlet);
router.post('/outlet/create', outletController.createOutlet); // Alias for onboarding setup
router.put('/outlets/:id', outletController.updateOutlet);

// ==========================================
// PAYMENT ROUTES
// ==========================================
router.post('/payments/create-order', paymentController.createOrder);
router.post('/payments/verify', paymentController.verifyPayment);

// ==========================================
// ORDER ROUTES
// ==========================================
router.get('/orders', orderController.getOrders);
router.post('/orders', orderController.addOrder);
router.get('/orders/archived', orderController.getArchivedOrders);
router.get('/orders/:id', orderController.getOrderById);
router.put('/orders/:id', orderController.updateOrder);
router.post('/orders/:id/settle', settlementController.settleOrder);

// ==========================================
// E-BILL ROUTES
// ==========================================
router.post('/ebill/send', ebillController.sendEBill);

// ==========================================
// SALES/REPORT ROUTES
// ==========================================
router.get('/sales/daily', salesController.getDailySales);
router.get('/sales/categories', salesController.getCategorySales);
router.get('/sales/items', salesController.getItemSales);
router.get('/sales/payments', salesController.getPaymentSales);
router.get('/sales/dashboard', salesController.getSalesDashboard);
router.get('/reports/daily-sales', reportController.getDailySales);
router.get('/reports/item-wise', reportController.getItemWiseSales);

// ==========================================
// DASHBOARD ROUTES
// ==========================================
router.get('/dashboard', dashboardController.getDashboardStats);

// ==========================================
// ANALYTICS ROUTES
// ==========================================
router.get('/analytics/trends', analyticsController.getSalesTrends);
router.get('/analytics/top-products', analyticsController.getTopProducts);
router.get('/analytics/peak-hours', analyticsController.getPeakHours);
router.get('/analytics/summary', analyticsController.getSummary);
router.get('/analytics/staff-performance', analyticsController.getAvgTicketsPerAgent);

// ==========================================
// PURCHASE ROUTES
// ==========================================
router.get('/purchases', purchaseController.getPurchases);
router.post('/purchases', purchaseController.addPurchase);

// ==========================================
// INVENTORY SALE ROUTES
// ==========================================
router.get('/inventory-sales', inventorySaleController.getInventorySales);
router.post('/inventory-sales', inventorySaleController.addInventorySale);

// ==========================================
// INVENTORY DASHBOARD ROUTES
// ==========================================
router.get('/inventory/dashboard', inventoryDashboardController.getDashboardSummary);

// ==========================================
// INVENTORY ITEM ROUTES
// ==========================================
router.get('/inventory/items', inventoryController.getInventoryItems);
router.post('/inventory/items', inventoryController.addInventoryItem);
router.put('/inventory/items/:id', inventoryController.updateInventoryItem);
router.delete('/inventory/items/:id', inventoryController.deleteInventoryItem);

// ==========================================
// INVENTORY CATEGORY ROUTES
// ==========================================
router.get('/inventory-categories', inventoryCategoryController.getCategories);
router.post('/inventory-categories', inventoryCategoryController.addCategory);
router.put('/inventory-categories/:id', inventoryCategoryController.updateCategory);
router.delete('/inventory-categories/:id', inventoryCategoryController.deleteCategory);
router.put('/inventory-categories/:id/status', inventoryCategoryController.toggleStatus);

// ==========================================
// RECIPE ROUTES
// ==========================================
router.get('/recipes', recipeController.getRecipes);
router.post('/recipes', recipeController.createRecipe);
router.get('/recipes/:id', recipeController.getRecipe);
router.put('/recipes/:id', recipeController.updateRecipe);
router.delete('/recipes/:id', recipeController.deleteRecipe);
router.get('/recipes/:id/availability', recipeController.checkAvailability);
router.get('/recipes/:id/cost-analysis', recipeController.getCostAnalysis);

// ==========================================
// ROLL TRACKING ROUTES
// ==========================================
router.post('/rolls', rollTrackingController.addRoll);
router.get('/rolls/stats/:outletId', rollTrackingController.getRollStats);
router.put('/rolls/:rollId/usage', rollTrackingController.updateUsage);

// ==========================================
// WHATSAPP ROUTES
// ==========================================
router.post('/whatsapp/send', whatsappController.sendMessage);
router.get('/whatsapp/webhook', whatsappController.receiveWebhook);
router.post('/whatsapp/webhook', whatsappController.receiveWebhook);
router.get('/whatsapp/status', whatsappController.getStatus);

// ==========================================
// WASTAGE ROUTES
// ==========================================
router.get('/inventory/wastage', wastageController.getWastageRecords);
router.post('/inventory/wastage', wastageController.addWastageRecord);
router.delete('/inventory/wastage/:id', wastageController.deleteWastageRecord);

// ==========================================
// STOCK ADJUSTMENT ROUTES
// ==========================================
router.post('/inventory/purchase-legacy', stockController.purchaseStock); // Alias
router.post('/inventory/self-consume', stockController.selfConsumeStock);
router.post('/inventory/adjust', stockController.adjustStock);
router.get('/inventory/adjustments', stockController.getAdjustments);
router.post('/inventory/adjustments', stockController.createAdjustment);
router.get('/inventory/transactions', stockController.getTransactions);
router.get('/inventory/low-stock', stockController.getLowStockItems);

// ==========================================
// SUPPLIER ROUTES
// ==========================================
router.get('/inventory/suppliers', supplierController.getSuppliers);
router.post('/inventory/suppliers', supplierController.addSupplier);
router.put('/inventory/suppliers/:id', supplierController.updateSupplier);
router.delete('/inventory/suppliers/:id', supplierController.deleteSupplier);

// ==========================================
// STAFF/USERS ROUTES
// ==========================================
router.get('/users', staffController.getUsers);
router.post('/users', staffController.createStaff);
router.put('/users/:id', staffController.updateStaff);
router.delete('/users/:id', staffController.deleteStaff);

// ==========================================
// PRODUCT TYPE ROUTES
// ==========================================
router.get('/product-types', productTypeController.getProductTypes);
router.post('/product-types', productTypeController.createProductType);
router.put('/product-types/:id', productTypeController.updateProductType);
router.delete('/product-types/:id', productTypeController.deleteProductType);

// ==========================================
// EXPENSE TYPE ROUTES
// ==========================================
router.get('/expense-types', expenseTypeController.getExpenseTypes);
router.post('/expense-types', expenseTypeController.createExpenseType);
router.put('/expense-types/:id', expenseTypeController.updateExpenseType);
router.delete('/expense-types/:id', expenseTypeController.deleteExpenseType);

// ==========================================
// TABLES MANAGEMENT ROUTES
// ==========================================
router.get('/tables-management', tableManagementController.getTables);
router.post('/tables-management', tableManagementController.createTable);
router.put('/tables-management/:id', tableManagementController.updateTable);
router.delete('/tables-management/:id', tableManagementController.deleteTable);

// ==========================================
// LIVE FEEDING ROUTES
// ==========================================
router.get('/live-orders', liveController.getLiveOrders);
router.get('/live-stats', liveController.getLiveStats);

// ==========================================
// KITCHEN/KOT ROUTES
// ==========================================
router.get('/kitchen/orders', kitchenController.getKitchenOrders);
router.put('/kitchen/orders/:id/status', kitchenController.updateKitchenOrderStatus);
router.get('/kitchen/stats', kitchenController.getKitchenStats);

// ==========================================
// CONTROL CENTER ROUTES
// ==========================================
router.get('/control-center', controlCenterController.getStats);
router.get('/system-health', controlCenterController.getSystemHealth);

// ==========================================
// BILLING CONFIG ROUTES
// ==========================================
router.get('/billing/config', billingConfigController.getConfig);
router.put('/billing/config', billingConfigController.updateConfig);
router.patch('/billing/config', billingConfigController.patchConfig);

// ==========================================
// BUSINESS ROUTES
// ==========================================
router.get('/business', businessController.getBusinessInfo);
router.put('/business', businessController.updateBusinessInfo);

// ==========================================
// CATEGORY ROUTES
// ==========================================
router.get('/categories', categoryController.getCategories);
router.post('/categories', uploadSingle, categoryController.addCategory);
router.put('/categories/:id', uploadSingle, categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);

// ==========================================
// PRODUCT ROUTES
// ==========================================
router.get('/products', productController.getProducts);
router.post('/products', uploadSingle, productController.addProduct);
router.put('/products/:id', uploadSingle, productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

// ==========================================
// HEALTH CHECK & RECOVERY ROUTES
// ==========================================
router.get('/health', tenantHealthController.getHealthStatus);
router.post('/health/recover', tenantHealthController.recoverTenant);
router.get('/health/validate', tenantHealthController.validateSchema);

module.exports = router;
