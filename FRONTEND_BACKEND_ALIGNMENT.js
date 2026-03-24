/**
 * COMPREHENSIVE FRONTEND-BACKEND API ALIGNMENT REPORT
 * Generated: March 23, 2026
 * 
 * This document maps every frontend API call to backend routes
 * and identifies missing implementations.
 */

// ==========================================
// FRONTEND API CALLS EXTRACTED FROM CODEBASE
// ==========================================

const FRONTEND_APIS = [
  // AUTH / ONBOARDING
  { method: 'POST', url: '/api/auth/send-otp', source: 'Auth Flow' },
  { method: 'POST', url: '/api/auth/verify-otp', source: 'Auth Flow' },
  { method: 'POST', url: '/api/auth/login', source: 'Auth Flow' },
  { method: 'GET', url: '/api/tenant/profile', source: 'Profile' },
  { method: 'PUT', url: '/api/tenant/profile', source: 'Profile' },
  { method: 'POST', url: '/api/auth/logout', source: 'Auth Flow' },
  { method: 'POST', url: '/api/onboarding/business', source: 'Onboarding' },
  { method: 'GET', url: '/api/super-admin/businesses', source: 'SuperAdmin' },
  { method: 'POST', url: '/api/super-admin/businesses/:id/approve', source: 'SuperAdmin' },
  { method: 'POST', url: '/api/super-admin/businesses/:id/reject', source: 'SuperAdmin' },

  // CATEGORIES (Product Categories)
  { method: 'GET', url: '/api/tenant/categories', source: 'Categories.jsx' },
  { method: 'POST', url: '/api/tenant/categories', source: 'Categories.jsx' },
  { method: 'PUT', url: '/api/tenant/categories/:id', source: 'Categories.jsx' },
  { method: 'DELETE', url: '/api/tenant/categories/:id', source: 'Categories.jsx' },

  // PRODUCTS
  { method: 'GET', url: '/api/tenant/products', source: 'Products.jsx, ProductTypes.jsx' },
  { method: 'POST', url: '/api/tenant/products', source: 'Products.jsx' },
  { method: 'PUT', url: '/api/tenant/products/:id', source: 'Products.jsx' },
  { method: 'DELETE', url: '/api/tenant/products/:id', source: 'Products.jsx' },

  // PRODUCT TYPES
  { method: 'GET', url: '/api/tenant/product-types', source: 'ProductTypes.jsx' },
  { method: 'POST', url: '/api/tenant/product-types', source: 'ProductTypes.jsx' },
  { method: 'PUT', url: '/api/tenant/product-types/:id', source: 'ProductTypes.jsx' },
  { method: 'DELETE', url: '/api/tenant/product-types/:id', source: 'ProductTypes.jsx' },

  // INVENTORY CATEGORIES
  { method: 'GET', url: '/api/tenant/inventory-categories', source: 'InventoryCategories.jsx' },
  { method: 'POST', url: '/api/tenant/inventory-categories', source: 'InventoryCategories.jsx' },
  { method: 'PUT', url: '/api/tenant/inventory-categories/:id', source: 'InventoryCategories.jsx' },
  { method: 'DELETE', url: '/api/tenant/inventory-categories/:id', source: 'InventoryCategories.jsx' },
  { method: 'PUT', url: '/api/tenant/inventory-categories/:id/status', source: 'InventoryCategories.jsx' },

  // INVENTORY ITEMS (Raw Materials)
  { method: 'GET', url: '/api/tenant/inventory/items', source: 'RawMaterials.jsx, StockPurchase.jsx, WastageManagement.jsx, InventoryCategories.jsx' },
  { method: 'POST', url: '/api/tenant/inventory/items', source: 'RawMaterials.jsx, TestAddItem.jsx' },
  { method: 'PUT', url: '/api/tenant/inventory/items/:id', source: 'RawMaterials.jsx' },
  { method: 'DELETE', url: '/api/tenant/inventory/items/:id', source: 'RawMaterials.jsx' },

  // INVENTORY TRANSACTIONS
  { method: 'GET', url: '/api/tenant/inventory/transactions', source: 'Transactions.jsx, InventoryDashboard.jsx' },
  { method: 'PUT', url: '/api/tenant/inventory/transactions/:id', source: 'StockPurchase.jsx, StockAdjustment.jsx, SelfConsume.jsx, WastageManagement.jsx' },
  { method: 'DELETE', url: '/api/tenant/inventory/transactions/:id', source: 'StockPurchase.jsx, StockAdjustment.jsx, SelfConsume.jsx, WastageManagement.jsx' },

  // STOCK OPERATIONS
  { method: 'POST', url: '/api/tenant/inventory/purchase', source: 'StockPurchase.jsx' },
  { method: 'GET', url: '/api/tenant/purchases', source: 'StockPurchase.jsx' },

  // WASTAGE
  { method: 'GET', url: '/api/tenant/inventory/wastage', source: 'WastageManagement.jsx' },
  { method: 'POST', url: '/api/tenant/inventory/wastage', source: 'WastageManagement.jsx' },

  // SUPPLIERS
  { method: 'GET', url: '/api/tenant/inventory/suppliers', source: 'Suppliers.jsx, StockPurchase.jsx' },
  { method: 'POST', url: '/api/tenant/inventory/suppliers', source: 'Suppliers.jsx' },
  { method: 'PUT', url: '/api/tenant/inventory/suppliers/:id', source: 'Suppliers.jsx' },
  { method: 'DELETE', url: '/api/tenant/inventory/suppliers/:id', source: 'Suppliers.jsx' },

  // DASHBOARD & ANALYTICS
  { method: 'GET', url: '/api/tenant/dashboard', source: 'InventoryDashboard.jsx' },
  { method: 'GET', url: '/api/tenant/inventory/low-stock', source: 'InventoryDashboard.jsx' },

  // USERS
  { method: 'GET', url: '/api/tenant/users', source: 'WastageManagement.jsx' },

  // TABLES
  { method: 'GET', url: '/api/tenant/tables', source: 'TableManager.jsx, Tables.jsx, TableAreas.jsx' },
  { method: 'POST', url: '/api/tenant/tables', source: 'TableManager.jsx' },
  { method: 'PUT', url: '/api/tenant/tables/:id', source: 'TableManager.jsx, Tables.jsx' },
  { method: 'DELETE', url: '/api/tenant/tables/:id', source: 'TableManager.jsx' },

  // AREAS
  { method: 'GET', url: '/api/tenant/areas', source: 'AreaManager.jsx, TableAreas.jsx' },
  { method: 'POST', url: '/api/tenant/areas', source: 'AreaManager.jsx' },
  { method: 'PUT', url: '/api/tenant/areas/:id', source: 'AreaManager.jsx' },
  { method: 'DELETE', url: '/api/tenant/areas/:id', source: 'AreaManager.jsx' },

  // ORDERS
  { method: 'GET', url: '/api/tenant/orders', source: 'OrderDetails.jsx' },
  { method: 'POST', url: '/api/tenant/orders', source: 'Order Flow' },
  { method: 'GET', url: '/api/tenant/orders/:id', source: 'Order Flow' },
  { method: 'PUT', url: '/api/tenant/orders/:id', source: 'Order Flow' },

  // BILLING
  { method: 'GET', url: '/api/tenant/billing/config', source: 'Billing Config' },
  { method: 'PUT', url: '/api/tenant/billing/config', source: 'Billing Config' },
  { method: 'PATCH', url: '/api/tenant/billing/config', source: 'Billing Config' },

  // PAYMENTS
  { method: 'POST', url: '/api/tenant/payments/create-order', source: 'Payment Flow' },
  { method: 'POST', url: '/api/tenant/payments/verify', source: 'Payment Flow' },

  // REPORTS
  { method: 'GET', url: '/api/tenant/reports/daily-sales', source: 'Reports' },
  { method: 'GET', url: '/api/tenant/reports/item-sales', source: 'Reports' },

  // ANALYTICS
  { method: 'GET', url: '/api/analytics/sales-trends', source: 'Analytics' },
  { method: 'GET', url: '/api/analytics/top-products', source: 'Analytics' },

  // RECIPES
  { method: 'GET', url: '/api/tenant/recipes', source: 'Recipes' },
  { method: 'POST', url: '/api/tenant/recipes', source: 'Recipes' },
  { method: 'GET', url: '/api/tenant/recipes/:id', source: 'Recipes' },
  { method: 'PUT', url: '/api/tenant/recipes/:id', source: 'Recipes' },
  { method: 'DELETE', url: '/api/tenant/recipes/:id', source: 'Recipes' },

  // UPLOAD
  { method: 'POST', url: '/api/upload/image', source: 'imageUpload.js' },
  { method: 'DELETE', url: '/api/upload/image/:publicId', source: 'imageUpload.js' },

  // STAFF/USERS
  { method: 'GET', url: '/api/tenant/staff', source: 'StaffMaster.jsx' },
  { method: 'POST', url: '/api/tenant/staff', source: 'StaffMaster.jsx' },
  { method: 'PUT', url: '/api/tenant/staff/:id', source: 'StaffMaster.jsx' },
  { method: 'DELETE', url: '/api/tenant/staff/:id', source: 'StaffMaster.jsx' },

  // CAFE MANAGEMENT (SuperAdmin)
  { method: 'GET', url: '/api/super-admin/cafes', source: 'CafeManager.jsx' },
  { method: 'POST', url: '/api/super-admin/cafes', source: 'CafeManager.jsx' },
];

// ==========================================
// MISSING BACKEND ROUTES (CRITICAL)
// ==========================================

const MISSING_BACKEND_ROUTES = [
  // HIGH PRIORITY - Breaking frontend functionality
  { method: 'GET', url: '/api/tenant/product-types', controller: 'productTypeController.getProductTypes' },
  { method: 'POST', url: '/api/tenant/product-types', controller: 'productTypeController.createProductType' },
  { method: 'PUT', url: '/api/tenant/product-types/:id', controller: 'productTypeController.updateProductType' },
  { method: 'DELETE', url: '/api/tenant/product-types/:id', controller: 'productTypeController.deleteProductType' },

  { method: 'GET', url: '/api/tenant/inventory-categories', controller: 'inventoryCategoryController.getCategories' },
  { method: 'POST', url: '/api/tenant/inventory-categories', controller: 'inventoryCategoryController.addCategory' },
  { method: 'PUT', url: '/api/tenant/inventory-categories/:id', controller: 'inventoryCategoryController.updateCategory' },
  { method: 'DELETE', url: '/api/tenant/inventory-categories/:id', controller: 'inventoryCategoryController.deleteCategory' },
  { method: 'PUT', url: '/api/tenant/inventory-categories/:id/status', controller: 'inventoryCategoryController.updateCategoryStatus' },

  { method: 'GET', url: '/api/tenant/inventory/items', controller: 'inventoryController.getItems' },
  { method: 'POST', url: '/api/tenant/inventory/items', controller: 'inventoryController.addItem' },
  { method: 'PUT', url: '/api/tenant/inventory/items/:id', controller: 'inventoryController.updateItem' },
  { method: 'DELETE', url: '/api/tenant/inventory/items/:id', controller: 'inventoryController.deleteItem' },

  { method: 'GET', url: '/api/tenant/inventory/transactions', controller: 'inventoryController.getTransactions' },
  { method: 'PUT', url: '/api/tenant/inventory/transactions/:id', controller: 'inventoryController.updateTransaction' },
  { method: 'DELETE', url: '/api/tenant/inventory/transactions/:id', controller: 'inventoryController.deleteTransaction' },

  { method: 'POST', url: '/api/tenant/inventory/purchase', controller: 'inventoryController.addPurchase' },
  { method: 'GET', url: '/api/tenant/purchases', controller: 'purchaseController.getPurchases' },

  { method: 'GET', url: '/api/tenant/inventory/wastage', controller: 'inventoryController.getWastage' },
  { method: 'POST', url: '/api/tenant/inventory/wastage', controller: 'inventoryController.addWastage' },

  { method: 'GET', url: '/api/tenant/inventory/suppliers', controller: 'supplierController.getSuppliers' },
  { method: 'POST', url: '/api/tenant/inventory/suppliers', controller: 'supplierController.createSupplier' },
  { method: 'PUT', url: '/api/tenant/inventory/suppliers/:id', controller: 'supplierController.updateSupplier' },
  { method: 'DELETE', url: '/api/tenant/inventory/suppliers/:id', controller: 'supplierController.deleteSupplier' },

  { method: 'GET', url: '/api/tenant/inventory/low-stock', controller: 'inventoryController.getLowStock' },

  { method: 'GET', url: '/api/tenant/users', controller: 'userController.getUsers' },
  { method: 'GET', url: '/api/tenant/staff', controller: 'staffController.getStaff' },
  { method: 'POST', url: '/api/tenant/staff', controller: 'staffController.createStaff' },
  { method: 'PUT', url: '/api/tenant/staff/:id', controller: 'staffController.updateStaff' },
  { method: 'DELETE', url: '/api/tenant/staff/:id', controller: 'staffController.deleteStaff' },

  { method: 'GET', url: '/api/tenant/tables', controller: 'tableController.getTables' },
  { method: 'POST', url: '/api/tenant/tables', controller: 'tableController.addTable' },
  { method: 'PUT', url: '/api/tenant/tables/:id', controller: 'tableController.updateTable' },
  { method: 'DELETE', url: '/api/tenant/tables/:id', controller: 'tableController.deleteTable' },

  { method: 'GET', url: '/api/tenant/areas', controller: 'areaController.getAreas' },
  { method: 'POST', url: '/api/tenant/areas', controller: 'areaController.addArea' },
  { method: 'PUT', url: '/api/tenant/areas/:id', controller: 'areaController.updateArea' },
  { method: 'DELETE', url: '/api/tenant/areas/:id', controller: 'areaController.deleteArea' },

  { method: 'GET', url: '/api/tenant/dashboard', controller: 'dashboardController.getDashboardStats' },

  { method: 'GET', url: '/api/tenant/recipes', controller: 'recipeController.getRecipes' },
  { method: 'POST', url: '/api/tenant/recipes', controller: 'recipeController.createRecipe' },
  { method: 'GET', url: '/api/tenant/recipes/:id', controller: 'recipeController.getRecipe' },
  { method: 'PUT', url: '/api/tenant/recipes/:id', controller: 'recipeController.updateRecipe' },
  { method: 'DELETE', url: '/api/tenant/recipes/:id', controller: 'recipeController.deleteRecipe' },

  { method: 'GET', url: '/api/tenant/billing/config', controller: 'billingController.getConfig' },
  { method: 'PUT', url: '/api/tenant/billing/config', controller: 'billingController.updateConfig' },
  { method: 'PATCH', url: '/api/tenant/billing/config', controller: 'billingController.patchConfig' },

  { method: 'POST', url: '/api/onboarding/business', controller: 'onboardingController.onboardBusiness' },
];

// ==========================================
// EXISTING BACKEND ROUTES (VERIFIED)
// ==========================================

const EXISTING_BACKEND_ROUTES = [
  { method: 'POST', url: '/api/auth/send-otp', status: 'exists' },
  { method: 'POST', url: '/api/auth/verify-otp', status: 'exists' },
  { method: 'POST', url: '/api/auth/login', status: 'exists' },
  { method: 'POST', url: '/api/auth/logout', status: 'exists' },
  { method: 'GET', url: '/api/tenant/profile', status: 'exists' },
  { method: 'PUT', url: '/api/tenant/profile', status: 'exists' },
  { method: 'GET', url: '/api/super-admin/businesses', status: 'exists' },
  { method: 'POST', url: '/api/super-admin/businesses/:id/approve', status: 'exists' },
  { method: 'POST', url: '/api/super-admin/businesses/:id/reject', status: 'exists' },
  { method: 'GET', url: '/api/tenant/categories', status: 'exists' },
  { method: 'POST', url: '/api/tenant/categories', status: 'exists' },
  { method: 'PUT', url: '/api/tenant/categories/:id', status: 'exists' },
  { method: 'DELETE', url: '/api/tenant/categories/:id', status: 'exists' },
  { method: 'GET', url: '/api/tenant/products', status: 'exists' },
  { method: 'POST', url: '/api/tenant/products', status: 'exists' },
  { method: 'PUT', url: '/api/tenant/products/:id', status: 'exists' },
  { method: 'DELETE', url: '/api/tenant/products/:id', status: 'exists' },
  { method: 'GET', url: '/api/tenant/orders', status: 'exists' },
  { method: 'POST', url: '/api/tenant/orders', status: 'exists' },
  { method: 'GET', url: '/api/tenant/orders/:id', status: 'exists' },
  { method: 'PUT', url: '/api/tenant/orders/:id', status: 'exists' },
  { method: 'GET', url: '/api/tenant/reports/daily-sales', status: 'exists' },
  { method: 'GET', url: '/api/tenant/reports/item-sales', status: 'exists' },
  { method: 'GET', url: '/api/analytics/sales-trends', status: 'exists' },
  { method: 'GET', url: '/api/analytics/top-products', status: 'exists' },
  { method: 'POST', url: '/api/tenant/payments/create-order', status: 'exists' },
  { method: 'POST', url: '/api/tenant/payments/verify', status: 'exists' },
  { method: 'POST', url: '/api/upload/image', status: 'exists' },
  { method: 'DELETE', url: '/api/upload/image/:publicId', status: 'exists' },
];

module.exports = {
  FRONTEND_APIS,
  MISSING_BACKEND_ROUTES,
  EXISTING_BACKEND_ROUTES,
  stats: {
    totalFrontendApis: FRONTEND_APIS.length,
    existingRoutes: EXISTING_BACKEND_ROUTES.length,
    missingRoutes: MISSING_BACKEND_ROUTES.length,
    coverage: ((EXISTING_BACKEND_ROUTES.length / FRONTEND_APIS.length) * 100).toFixed(1) + '%'
  }
};
