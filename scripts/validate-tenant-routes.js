#!/usr/bin/env node
/**
 * Tenant Route Syntax Validation
 * Verifies all route handlers are properly defined without needing a database
 */

const express = require('express');

console.log('🔍 Validating Tenant Routes...\n');

const issues = [];
const validated = [];

// Test all controller imports
const controllers = [
  { name: 'profileController', path: '../controllers/tenant/profileController', methods: ['getProfile', 'updateProfile'] },
  { name: 'tableController', path: '../controllers/tenant/tableController', methods: ['getTables', 'addTable', 'updateTable', 'deleteTable'] },
  { name: 'areaController', path: '../controllers/tenant/areaController', methods: ['getAreas', 'addArea', 'updateArea', 'deleteArea'] },
  { name: 'businessTimingController', path: '../controllers/tenant/businessTimingController', methods: ['getTimings', 'createTiming'] },
  { name: 'outletController', path: '../controllers/tenant/outletController', methods: ['getOutlets', 'createOutlet', 'updateOutlet'] },
  { name: 'paymentController', path: '../controllers/tenant/paymentController', methods: ['createOrder', 'verifyPayment', 'webHookVerification'] },
  { name: 'orderController', path: '../controllers/tenant/orderController', methods: ['getOrders', 'getOrderById', 'addOrder', 'updateOrder', 'getArchivedOrders'] },
  { name: 'ebillController', path: '../controllers/tenant/ebillController', methods: ['sendEBill'] },
  { name: 'salesController', path: '../controllers/tenant/salesController', methods: ['getDailySales', 'getCategorySales', 'getItemSales', 'getPaymentSales', 'getSalesDashboard'] },
  { name: 'reportController', path: '../controllers/tenant/reportController', methods: ['getDailySales', 'getItemWiseSales', 'getSystemStats'] },
  { name: 'dashboardController', path: '../controllers/tenant/dashboardController', methods: ['getDashboardStats'] },
  { name: 'analyticsController', path: '../controllers/tenant/analyticsController', methods: ['getSalesTrends', 'getTopProducts', 'getPeakHours', 'getSummary', 'getAvgTicketsPerAgent'] },
  { name: 'purchaseController', path: '../controllers/tenant/purchaseController', methods: ['getPurchases', 'addPurchase'] },
  { name: 'inventorySaleController', path: '../controllers/tenant/inventorySaleController', methods: ['getInventorySales', 'addInventorySale'] },
  { name: 'inventoryDashboardController', path: '../controllers/tenant/inventoryDashboardController', methods: ['getDashboardSummary'] },
  { name: 'inventoryController', path: '../controllers/tenant/inventoryController', methods: ['getInventoryItems', 'addInventoryItem', 'updateInventoryItem', 'deleteInventoryItem'] },
  { name: 'inventoryCategoryController', path: '../controllers/tenant/inventoryCategoryController', methods: ['getCategories', 'addCategory', 'updateCategory', 'deleteCategory', 'toggleStatus'] },
  { name: 'recipeController', path: '../controllers/tenant/recipeController', methods: ['getRecipes', 'getRecipe', 'createRecipe', 'updateRecipe', 'deleteRecipe', 'checkAvailability', 'getCostAnalysis'] },
  { name: 'rollTrackingController', path: '../controllers/tenant/rollTrackingController', methods: ['addRoll', 'getRollStats', 'updateUsage'] },
  { name: 'whatsappController', path: '../controllers/tenant/whatsappController', methods: ['sendMessage', 'receiveWebhook', 'getStatus'] },
  { name: 'wastageController', path: '../controllers/tenant/wastageController', methods: ['getWastageRecords', 'addWastageRecord', 'deleteWastageRecord'] },
  { name: 'stockController', path: '../controllers/tenant/stockController', methods: ['purchaseStock', 'selfConsumeStock', 'adjustStock', 'getTransactions', 'getLowStockItems', 'createAdjustment', 'getAdjustments'] },
  { name: 'supplierController', path: '../controllers/tenant/supplierController', methods: ['getSuppliers', 'addSupplier', 'updateSupplier', 'deleteSupplier'] },
  { name: 'staffController', path: '../controllers/tenant/staffController', methods: ['getStaff', 'createStaff', 'updateStaff', 'deleteStaff', 'getUsers'] },
  { name: 'productTypeController', path: '../controllers/tenant/productTypeController', methods: ['getProductTypes', 'createProductType', 'updateProductType', 'deleteProductType'] },
  { name: 'expenseTypeController', path: '../controllers/tenant/expenseTypeController', methods: ['getExpenseTypes', 'createExpenseType', 'updateExpenseType', 'deleteExpenseType'] },
  { name: 'tableManagementController', path: '../controllers/tenant/tableManagementController', methods: ['getTables', 'createTable', 'updateTable', 'deleteTable'] },
  { name: 'liveController', path: '../controllers/tenant/liveController', methods: ['getLiveOrders', 'getLiveStats'] },
  { name: 'controlCenterController', path: '../controllers/tenant/controlCenterController', methods: ['getStats', 'getSystemHealth'] },
  { name: 'billingConfigController', path: '../controllers/tenant/billingConfigController', methods: ['getConfig', 'updateConfig', 'patchConfig'] },
  { name: 'businessController', path: '../controllers/tenant/businessController', methods: ['getBusinessInfo', 'updateBusinessInfo'] },
  { name: 'categoryController', path: '../controllers/tenant/category.controller', methods: ['getCategories', 'addCategory', 'updateCategory', 'deleteCategory'] },
  { name: 'productController', path: '../controllers/tenant/productController', methods: ['getProducts', 'addProduct', 'updateProduct', 'deleteProduct'] },
];

console.log('📦 Validating Controllers:\n');

for (const ctrl of controllers) {
  try {
    const controller = require(ctrl.path);
    const missing = [];
    
    for (const method of ctrl.methods) {
      if (typeof controller[method] !== 'function') {
        missing.push(method);
      }
    }
    
    if (missing.length > 0) {
      issues.push({
        controller: ctrl.name,
        missing: missing
      });
      console.log(`❌ ${ctrl.name}: Missing [${missing.join(', ')}]`);
    } else {
      validated.push(ctrl.name);
      console.log(`✅ ${ctrl.name}: ${ctrl.methods.length} methods`);
    }
  } catch (error) {
    issues.push({
      controller: ctrl.name,
      error: error.message
    });
    console.log(`❌ ${ctrl.name}: ${error.message}`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Validated: ${validated.length} controllers`);
console.log(`❌ Issues: ${issues.length} controllers`);

if (issues.length > 0) {
  console.log('\nIssues found:');
  issues.forEach(issue => {
    if (issue.missing) {
      console.log(`  - ${issue.controller}: Missing methods [${issue.missing.join(', ')}]`);
    } else if (issue.error) {
      console.log(`  - ${issue.controller}: ${issue.error}`);
    }
  });
  process.exit(1);
} else {
  console.log('\n✅ All tenant route handlers are properly defined!');
  process.exit(0);
}
