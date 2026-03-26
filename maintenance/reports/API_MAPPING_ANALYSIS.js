/**
 * FRONTEND-BACKEND API MAPPING ANALYSIS
 * =====================================
 * 
 * This document maps all frontend API calls to backend routes
 * and identifies missing/broken endpoints.
 */

// ===========================================
// FRONTEND APIs DETECTED (from src/https/index.js)
// ===========================================

const FRONTEND_APIS = {
  // Auth Endpoints
  AUTH: [
    { method: 'POST', url: '/api/auth/send-otp', body: ['email'], response: { success: true, message: 'OTP sent' } },
    { method: 'POST', url: '/api/auth/verify-otp', body: ['email', 'otp'], response: { success: true, token, user } },
    { method: 'POST', url: '/api/auth/login', body: ['email', 'password'], response: { success: true, accessToken, refreshToken, user } },
    { method: 'GET', url: '/api/tenant/profile', response: { success: true, user } },
    { method: 'PUT', url: '/api/tenant/profile', body: ['...profileData'], response: { success: true, user } },
    { method: 'POST', url: '/api/auth/logout', response: { success: true, message: 'Logout successful' } },
    { method: 'POST', url: '/api/onboarding/business', body: ['businessName', 'businessEmail', 'businessPhone', 'businessAddress', 'gstNumber', 'adminName', 'adminEmail', 'adminPassword'], response: { success: true, business, user } },
    { method: 'GET', url: '/api/super-admin/businesses', params: ['page', 'limit', 'status'], response: { success: true, businesses } },
    { method: 'POST', url: '/api/super-admin/businesses/:id/approve', response: { success: true, message: 'Business approved' } },
    { method: 'POST', url: '/api/super-admin/businesses/:id/reject', body: ['reason'], response: { success: true, message: 'Business rejected' } },
  ],

  // Table Endpoints
  TABLES: [
    { method: 'POST', url: '/api/tenant/tables', body: ['tableNumber', 'capacity', 'areaId', 'status'], response: { success: true, table } },
    { method: 'GET', url: '/api/tenant/tables', response: { success: true, tables } },
    { method: 'PUT', url: '/api/tenant/tables/:tableId', body: ['tableNumber', 'capacity', 'areaId', 'status'], response: { success: true, table } },
    { method: 'DELETE', url: '/api/tenant/tables/:id', response: { success: true, message: 'Table deleted' } },
  ],

  // Area Endpoints
  AREAS: [
    { method: 'POST', url: '/api/tenant/areas', body: ['name', 'description', 'capacity'], response: { success: true, area } },
    { method: 'GET', url: '/api/tenant/areas', params: ['outletId'], response: { success: true, areas } },
    { method: 'PUT', url: '/api/tenant/areas/:id', body: ['name', 'description', 'capacity'], response: { success: true, area } },
    { method: 'DELETE', url: '/api/tenant/areas/:id', response: { success: true, message: 'Area deleted' } },
  ],

  // Operation Timing Endpoints
  OPERATION_TIMINGS: [
    { method: 'GET', url: '/api/tenant/operation-timings', response: { success: true, timings } },
    { method: 'POST', url: '/api/tenant/operation-timings', body: ['day', 'openTime', 'closeTime', 'isOpen'], response: { success: true, timing } },
    { method: 'PUT', url: '/api/tenant/operation-timings/:id', body: ['day', 'openTime', 'closeTime', 'isOpen'], response: { success: true, timing } },
    { method: 'DELETE', url: '/api/tenant/operation-timings/:id', response: { success: true, message: 'Timing deleted' } },
  ],

  // Reports Endpoints
  REPORTS: [
    { method: 'GET', url: '/api/auth/debug/reports', params: ['businessId', 'outletId', 'startDate', 'endDate'], response: { success: true, reports } },
  ],

  // Outlet Endpoints
  OUTLETS: [
    { method: 'PUT', url: '/api/tenant/outlets/:outletId', body: ['name', 'address', 'phone', 'email', 'gstNumber'], response: { success: true, outlet } },
    { method: 'POST', url: '/api/tenant/outlets', body: ['name', 'address', 'phone', 'email', 'gstNumber', 'businessId'], response: { success: true, outlet } },
    { method: 'GET', url: '/api/tenant/outlets', response: { success: true, outlets } },
  ],

  // Payment Endpoints
  PAYMENTS: [
    { method: 'POST', url: '/api/tenant/payments/create-order', body: ['amount', 'currency', 'receipt'], response: { success: true, orderId, amount, currency } },
    { method: 'POST', url: '/api/tenant/payments/verify', body: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'], response: { success: true, message: 'Payment verified' } },
  ],

  // Order Endpoints
  ORDERS: [
    { method: 'POST', url: '/api/tenant/orders', body: ['items', 'tableId', 'customerName', 'customerPhone', 'orderType', 'paymentMethod', 'totalAmount'], response: { success: true, order } },
    { method: 'GET', url: '/api/tenant/orders', params: ['status', 'startDate', 'endDate', 'page', 'limit'], response: { success: true, orders } },
    { method: 'GET', url: '/api/tenant/orders/:id', response: { success: true, order } },
    { method: 'PUT', url: '/api/tenant/orders/:orderId', body: ['orderStatus', 'items', 'totalAmount'], response: { success: true, order } },
    { method: 'POST', url: '/api/tenant/ebill/send', body: ['orderId', 'customerEmail', 'customerPhone'], response: { success: true, message: 'E-bill sent' } },
  ],

  // Category Endpoints
  CATEGORIES: [
    { method: 'GET', url: '/api/tenant/categories', response: { success: true, categories } },
    { method: 'POST', url: '/api/tenant/categories', body: ['name', 'description', 'color', 'sortOrder', 'isActive'], response: { success: true, category } },
    { method: 'PUT', url: '/api/tenant/categories/:id', body: ['name', 'description', 'color', 'sortOrder', 'isActive'], response: { success: true, category } },
    { method: 'DELETE', url: '/api/tenant/categories/:id', response: { success: true, message: 'Category deleted' } },
  ],

  // Product Endpoints
  PRODUCTS: [
    { method: 'GET', url: '/api/tenant/products', params: ['categoryId'], response: { success: true, products } },
    { method: 'POST', url: '/api/tenant/products', body: ['name', 'description', 'price', 'categoryId', 'image', 'isAvailable', 'taxPercent', 'variants'], response: { success: true, product } },
    { method: 'PUT', url: '/api/tenant/products/:productId', body: ['name', 'description', 'price', 'categoryId', 'image', 'isAvailable', 'taxPercent', 'variants'], response: { success: true, product } },
    { method: 'DELETE', url: '/api/tenant/products/:id', response: { success: true, message: 'Product deleted' } },
  ],

  // Sales/Reports Endpoints
  SALES: [
    { method: 'GET', url: '/api/tenant/sales/daily', params: ['date'], response: { success: true, sales } },
    { method: 'GET', url: '/api/tenant/sales/categories', params: ['startDate', 'endDate'], response: { success: true, categorySales } },
    { method: 'GET', url: '/api/tenant/sales/items', params: ['startDate', 'endDate'], response: { success: true, itemSales } },
    { method: 'GET', url: '/api/tenant/sales/payments', params: ['startDate', 'endDate'], response: { success: true, paymentSales } },
  ],

  // Purchase Endpoints
  PURCHASES: [
    { method: 'GET', url: '/api/tenant/purchases', response: { success: true, purchases } },
    { method: 'POST', url: '/api/tenant/purchases', body: ['supplierId', 'items', 'totalAmount', 'purchaseDate', 'invoiceNumber'], response: { success: true, purchase } },
  ],

  // Inventory Sale Endpoints
  INVENTORY_SALES: [
    { method: 'GET', url: '/api/tenant/inventory-sales', response: { success: true, sales } },
    { method: 'POST', url: '/api/tenant/inventory-sales', body: ['inventoryItemId', 'quantity', 'salePrice', 'saleDate', 'customerName'], response: { success: true, sale } },
  ],

  // Raw Inventory Endpoints
  INVENTORY_ITEMS: [
    { method: 'GET', url: '/api/tenant/inventory/items', response: { success: true, items } },
    { method: 'POST', url: '/api/tenant/inventory/items', body: ['name', 'description', 'unit', 'categoryId', 'currentStock', 'minStockLevel', 'reorderPoint', 'costPerUnit', 'supplierId'], response: { success: true, item } },
    { method: 'PUT', url: '/api/tenant/inventory/items/:id', body: ['name', 'description', 'unit', 'categoryId', 'currentStock', 'minStockLevel', 'reorderPoint', 'costPerUnit', 'supplierId'], response: { success: true, item } },
    { method: 'DELETE', url: '/api/tenant/inventory/items/:id', response: { success: true, message: 'Item deleted' } },
  ],

  // Inventory Category Endpoints
  INVENTORY_CATEGORIES: [
    { method: 'GET', url: '/api/tenant/inventory-categories', response: { success: true, categories } },
    { method: 'POST', url: '/api/tenant/inventory-categories', body: ['name', 'description', 'color', 'parentCategoryId', 'minStockAlert', 'maxStockAlert'], response: { success: true, category } },
    { method: 'PUT', url: '/api/tenant/inventory-categories/:id', body: ['name', 'description', 'color', 'parentCategoryId', 'minStockAlert', 'maxStockAlert'], response: { success: true, category } },
    { method: 'DELETE', url: '/api/tenant/inventory-categories/:id', response: { success: true, message: 'Category deleted' } },
    { method: 'PUT', url: '/api/tenant/inventory-categories/:id/status', body: ['status'], response: { success: true, category } },
  ],

  // Recipe Endpoints
  RECIPES: [
    { method: 'GET', url: '/api/tenant/recipes', response: { success: true, recipes } },
    { method: 'GET', url: '/api/tenant/recipes/:id', response: { success: true, recipe } },
    { method: 'POST', url: '/api/tenant/recipes', body: ['name', 'description', 'productId', 'ingredients', 'instructions', 'prepTime', 'cookTime', 'servingSize'], response: { success: true, recipe } },
    { method: 'PUT', url: '/api/tenant/recipes/:id', body: ['name', 'description', 'productId', 'ingredients', 'instructions', 'prepTime', 'cookTime', 'servingSize'], response: { success: true, recipe } },
    { method: 'DELETE', url: '/api/tenant/recipes/:id', response: { success: true, message: 'Recipe deleted' } },
    { method: 'GET', url: '/api/tenant/recipes/:id/availability', response: { success: true, available, missingIngredients } },
    { method: 'GET', url: '/api/tenant/recipes/:id/cost-analysis', response: { success: true, totalCost, costPerServing, suggestedPrice, profitMargin } },
  ],

  // Wastage Endpoints
  WASTAGE: [
    { method: 'GET', url: '/api/tenant/inventory/wastage', response: { success: true, wastageRecords } },
    { method: 'POST', url: '/api/tenant/inventory/wastage', body: ['inventoryItemId', 'quantity', 'reason', 'wastageDate', 'notes'], response: { success: true, wastage } },
    { method: 'DELETE', url: '/api/tenant/inventory/wastage/:id', response: { success: true, message: 'Wastage record deleted' } },
  ],

  // Stock Adjustment Endpoints
  STOCK_ADJUSTMENTS: [
    { method: 'POST', url: '/api/tenant/inventory/purchase', body: ['inventoryItemId', 'quantity', 'costPerUnit', 'purchaseDate', 'supplierId', 'invoiceNumber'], response: { success: true, purchase } },
    { method: 'POST', url: '/api/tenant/inventory/self-consume', body: ['inventoryItemId', 'quantity', 'consumeDate', 'reason', 'recipeId'], response: { success: true, consumption } },
    { method: 'POST', url: '/api/tenant/inventory/adjust', body: ['inventoryItemId', 'quantity', 'adjustmentType', 'reason', 'adjustmentDate'], response: { success: true, adjustment } },
    { method: 'GET', url: '/api/tenant/inventory/adjustments', response: { success: true, adjustments } },
    { method: 'POST', url: '/api/tenant/inventory/adjustments', body: ['inventoryItemId', 'quantity', 'adjustmentType', 'reason', 'adjustmentDate'], response: { success: true, adjustment } },
    { method: 'GET', url: '/api/tenant/inventory/transactions', params: ['inventoryItemId', 'startDate', 'endDate', 'type'], response: { success: true, transactions } },
    { method: 'GET', url: '/api/tenant/inventory/low-stock', response: { success: true, lowStockItems } },
  ],

  // Staff Management
  STAFF: [
    { method: 'GET', url: '/api/tenant/users', response: { success: true, users } },
    { method: 'POST', url: '/api/tenant/users', body: ['name', 'email', 'phone', 'role', 'password', 'outletId'], response: { success: true, user } },
  ],

  // Accounting Endpoints
  ACCOUNTING: [
    { method: 'GET', url: '/api/tenant/accounting/accounts', response: { success: true, accounts } },
    { method: 'POST', url: '/api/tenant/accounting/accounts', body: ['name', 'type', 'openingBalance', 'currentBalance', 'description'], response: { success: true, account } },
    { method: 'PUT', url: '/api/tenant/accounting/accounts/:id', body: ['name', 'type', 'openingBalance', 'description'], response: { success: true, account } },
    { method: 'DELETE', url: '/api/tenant/accounting/accounts/:id', response: { success: true, message: 'Account deleted' } },
    { method: 'GET', url: '/api/tenant/accounting/transactions', params: ['accountId', 'startDate', 'endDate', 'type'], response: { success: true, transactions } },
    { method: 'POST', url: '/api/tenant/accounting/transactions', body: ['accountId', 'type', 'amount', 'description', 'transactionDate', 'referenceNumber', 'category'], response: { success: true, transaction } },
  ],

  // Dashboard Endpoints
  DASHBOARD: [
    { method: 'GET', url: '/api/tenant/dashboard', params: ['period', 'startDate', 'endDate'], response: { success: true, stats } },
    { method: 'GET', url: '/api/tenant/sales/dashboard', response: { success: true, salesStats } },
  ],

  // Timing Endpoints
  TIMINGS: [
    { method: 'GET', url: '/api/tenant/timing', response: { success: true, timings } },
    { method: 'POST', url: '/api/tenant/timing', body: ['day', 'openTime', 'closeTime', 'isOpen', 'specialHours'], response: { success: true, timing } },
  ],

  // Product Type Endpoints
  PRODUCT_TYPES: [
    { method: 'GET', url: '/api/tenant/product-types', response: { success: true, productTypes } },
    { method: 'POST', url: '/api/tenant/product-types', body: ['name', 'description'], response: { success: true, productType } },
  ],

  // Expense Type Endpoints
  EXPENSE_TYPES: [
    { method: 'GET', url: '/api/tenant/expense-types', response: { success: true, expenseTypes } },
    { method: 'POST', url: '/api/tenant/expense-types', body: ['name', 'description', 'isActive'], response: { success: true, expenseType } },
    { method: 'PUT', url: '/api/tenant/expense-types/:id', body: ['name', 'description', 'isActive'], response: { success: true, expenseType } },
    { method: 'DELETE', url: '/api/tenant/expense-types/:id', response: { success: true, message: 'Expense type deleted' } },
  ],

  // Tables Management Endpoints
  TABLES_MANAGEMENT: [
    { method: 'GET', url: '/api/tenant/tables-management', params: ['areaId', 'status', 'date'], response: { success: true, tables } },
    { method: 'POST', url: '/api/tenant/tables-management', body: ['tableNumber', 'capacity', 'areaId', 'shape', 'position'], response: { success: true, table } },
    { method: 'PUT', url: '/api/tenant/tables-management/:id', body: ['tableNumber', 'capacity', 'areaId', 'shape', 'position', 'status'], response: { success: true, table } },
    { method: 'DELETE', url: '/api/tenant/tables-management/:id', response: { success: true, message: 'Table deleted' } },
  ],

  // Live Feeding Endpoints
  LIVE_FEEDING: [
    { method: 'GET', url: '/api/tenant/live-orders', response: { success: true, liveOrders } },
    { method: 'GET', url: '/api/tenant/live-stats', response: { success: true, stats } },
  ],

  // Order Archive Endpoints
  ORDER_ARCHIVE: [
    { method: 'GET', url: '/api/tenant/orders/archived', params: ['startDate', 'endDate', 'page', 'limit'], response: { success: true, archivedOrders } },
  ],

  // Supplier Endpoints
  SUPPLIERS: [
    { method: 'GET', url: '/api/tenant/inventory/suppliers', response: { success: true, suppliers } },
    { method: 'POST', url: '/api/tenant/inventory/suppliers', body: ['name', 'contactPerson', 'email', 'phone', 'address', 'gstNumber', 'paymentTerms'], response: { success: true, supplier } },
    { method: 'PUT', url: '/api/tenant/inventory/suppliers/:id', body: ['name', 'contactPerson', 'email', 'phone', 'address', 'gstNumber', 'paymentTerms'], response: { success: true, supplier } },
    { method: 'DELETE', url: '/api/tenant/inventory/suppliers/:id', response: { success: true, message: 'Supplier deleted' } },
  ],

  // Control Center Endpoints
  CONTROL_CENTER: [
    { method: 'GET', url: '/api/tenant/control-center', response: { success: true, stats } },
    { method: 'GET', url: '/api/tenant/system-health', response: { success: true, health } },
  ],

  // Billing Configuration Endpoints
  BILLING_CONFIG: [
    { method: 'GET', url: '/api/tenant/billing/config', response: { success: true, config } },
    { method: 'PUT', url: '/api/tenant/billing/config', body: ['businessName', 'address', 'phone', 'email', 'gstNumber', 'taxPercent', 'receiptFooter'], response: { success: true, config } },
    { method: 'PATCH', url: '/api/tenant/billing/config', body: ['...partialConfig'], response: { success: true, config } },
  ],

  // Business Endpoints
  BUSINESS: [
    { method: 'GET', url: '/api/tenant/business', response: { success: true, business } },
    { method: 'PUT', url: '/api/tenant/business', body: ['name', 'address', 'phone', 'email', 'gstNumber', 'logo'], response: { success: true, business } },
  ],
};

// ===========================================
// BACKEND ROUTES STATUS
// ===========================================

const BACKEND_ROUTES_STATUS = {
  // EXISTING ROUTES (Found in routes/)
  EXISTING: [
    '/api/auth/*',              // auth.routes.js - exists
    '/api/onboarding/business', // onboardingRoute.js - exists (just added)
    '/api/super-admin/*',       // superAdminRoute.js - exists
    '/api/admin/*',             // adminRoute.js - exists
    '/api/user/*',              // userRoute.js - exists
    '/api/upload/*',            // uploadRoute.js - exists
    '/api/tenant/categories',   // tenant/category.routes.js - exists
    '/api/inventory/*',         // inventoryRoutes.js - exists
  ],

  // MISSING ROUTES (Need to create)
  MISSING: [
    // Tenant Profile
    '/api/tenant/profile',              // GET, PUT - MISSING
    
    // Tables
    '/api/tenant/tables',               // POST, GET - MISSING
    
    // Areas
    '/api/tenant/areas',                // POST, GET, PUT, DELETE - MISSING
    
    // Operation Timings
    '/api/tenant/operation-timings',    // GET, POST, PUT, DELETE - MISSING
    
    // Outlets
    '/api/tenant/outlets',              // POST, GET, PUT - MISSING
    
    // Payments
    '/api/tenant/payments/*',           // POST - MISSING
    
    // Orders
    '/api/tenant/orders',               // POST, GET - MISSING
    '/api/tenant/orders/archived',      // GET - MISSING
    '/api/tenant/ebill/send',           // POST - MISSING
    
    // Sales/Reports
    '/api/tenant/sales/*',              // GET - MISSING
    
    // Purchases
    '/api/tenant/purchases',            // GET, POST - MISSING
    
    // Inventory Sales
    '/api/tenant/inventory-sales',      // GET, POST - MISSING
    
    // Raw Inventory Items
    '/api/tenant/inventory/items',      // GET, POST, PUT, DELETE - MISSING
    
    // Inventory Categories
    '/api/tenant/inventory-categories', // GET, POST, PUT, DELETE - MISSING
    
    // Recipes
    '/api/tenant/recipes',              // GET, POST, PUT, DELETE - MISSING
    
    // Wastage
    '/api/tenant/inventory/wastage',    // GET, POST, DELETE - MISSING
    
    // Stock Adjustments
    '/api/tenant/inventory/purchase',   // POST - MISSING
    '/api/tenant/inventory/self-consume', // POST - MISSING
    '/api/tenant/inventory/adjust',     // POST - MISSING
    '/api/tenant/inventory/adjustments', // GET, POST - MISSING
    '/api/tenant/inventory/transactions', // GET - MISSING
    '/api/tenant/inventory/low-stock',  // GET - MISSING
    
    // Staff/Users
    '/api/tenant/users',                // GET, POST - MISSING
    
    // Accounting
    '/api/tenant/accounting/*',         // GET, POST, PUT, DELETE - MISSING
    
    // Dashboard
    '/api/tenant/dashboard',              // GET - MISSING
    
    // Timings
    '/api/tenant/timing',               // GET, POST - MISSING
    
    // Product Types
    '/api/tenant/product-types',        // GET, POST - MISSING
    
    // Expense Types
    '/api/tenant/expense-types',        // GET, POST, PUT, DELETE - MISSING
    
    // Tables Management
    '/api/tenant/tables-management',    // GET, POST, PUT, DELETE - MISSING
    
    // Live Feeding
    '/api/tenant/live-orders',          // GET - MISSING
    '/api/tenant/live-stats',           // GET - MISSING
    
    // Suppliers
    '/api/tenant/inventory/suppliers',  // GET, POST, PUT, DELETE - MISSING
    
    // Control Center
    '/api/tenant/control-center',       // GET - MISSING
    '/api/tenant/system-health',        // GET - MISSING
    
    // Billing Config
    '/api/tenant/billing/config',       // GET, PUT, PATCH - MISSING
    
    // Business
    '/api/tenant/business',             // GET, PUT - MISSING
  ]
};

module.exports = { FRONTEND_APIS, BACKEND_ROUTES_STATUS };
