/**
 * COMPLETE API MAPPING - Frontend to Backend
 * ==========================================
 * 
 * This document maps all frontend API calls to backend routes
 * and identifies missing/broken endpoints.
 */

const FRONTEND_APIS = {
  // ==========================================
  // AUTH ENDPOINTS (8 endpoints)
  // ==========================================
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

  // ==========================================
  // TABLE ENDPOINTS (4 endpoints)
  // ==========================================
  TABLES: [
    { method: 'POST', url: '/api/tenant/tables', body: ['tableNumber', 'capacity', 'areaId', 'status'], response: { success: true, table } },
    { method: 'GET', url: '/api/tenant/tables', response: { success: true, tables } },
    { method: 'PUT', url: '/api/tenant/tables/:tableId', body: ['tableNumber', 'capacity', 'areaId', 'status'], response: { success: true, table } },
    { method: 'DELETE', url: '/api/tenant/tables/:id', response: { success: true, message: 'Table deleted' } },
  ],

  // ==========================================
  // AREA ENDPOINTS (4 endpoints)
  // ==========================================
  AREAS: [
    { method: 'POST', url: '/api/tenant/areas', body: ['name', 'description', 'capacity'], response: { success: true, area } },
    { method: 'GET', url: '/api/tenant/areas', params: ['outletId'], response: { success: true, areas } },
    { method: 'PUT', url: '/api/tenant/areas/:id', body: ['name', 'description', 'capacity'], response: { success: true, area } },
    { method: 'DELETE', url: '/api/tenant/areas/:id', response: { success: true, message: 'Area deleted' } },
  ],

  // ==========================================
  // OPERATION TIMING ENDPOINTS (4 endpoints)
  // ==========================================
  OPERATION_TIMINGS: [
    { method: 'GET', url: '/api/tenant/operation-timings', response: { success: true, timings } },
    { method: 'POST', url: '/api/tenant/operation-timings', body: ['day', 'openTime', 'closeTime', 'isOpen'], response: { success: true, timing } },
    { method: 'PUT', url: '/api/tenant/operation-timings/:id', body: ['day', 'openTime', 'closeTime', 'isOpen'], response: { success: true, timing } },
    { method: 'DELETE', url: '/api/tenant/operation-timings/:id', response: { success: true, message: 'Timing deleted' } },
  ],

  // ==========================================
  // OUTLET ENDPOINTS (3 endpoints)
  // ==========================================
  OUTLETS: [
    { method: 'PUT', url: '/api/tenant/outlets/:outletId', body: ['name', 'address', 'phone', 'email', 'gstNumber'], response: { success: true, outlet } },
    { method: 'POST', url: '/api/tenant/outlets', body: ['name', 'address', 'phone', 'email', 'gstNumber', 'businessId'], response: { success: true, outlet } },
    { method: 'GET', url: '/api/tenant/outlets', response: { success: true, outlets } },
  ],

  // ==========================================
  // PAYMENT ENDPOINTS (2 endpoints)
  // ==========================================
  PAYMENTS: [
    { method: 'POST', url: '/api/tenant/payments/create-order', body: ['amount', 'currency', 'receipt'], response: { success: true, orderId, amount, currency } },
    { method: 'POST', url: '/api/tenant/payments/verify', body: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'], response: { success: true, message: 'Payment verified' } },
  ],

  // ==========================================
  // ORDER ENDPOINTS (6 endpoints)
  // ==========================================
  ORDERS: [
    { method: 'POST', url: '/api/tenant/orders', body: ['items', 'tableId', 'customerName', 'customerPhone', 'orderType', 'paymentMethod', 'totalAmount'], response: { success: true, order } },
    { method: 'GET', url: '/api/tenant/orders', params: ['status', 'startDate', 'endDate', 'page', 'limit'], response: { success: true, orders } },
    { method: 'GET', url: '/api/tenant/orders/:id', response: { success: true, order } },
    { method: 'PUT', url: '/api/tenant/orders/:orderId', body: ['orderStatus', 'items', 'totalAmount'], response: { success: true, order } },
    { method: 'POST', url: '/api/tenant/ebill/send', body: ['orderId', 'customerEmail', 'customerPhone'], response: { success: true, message: 'E-bill sent' } },
    { method: 'GET', url: '/api/tenant/orders/archived', params: ['startDate', 'endDate', 'page', 'limit'], response: { success: true, archivedOrders } },
  ],

  // ==========================================
  // CATEGORY ENDPOINTS (4 endpoints)
  // ==========================================
  CATEGORIES: [
    { method: 'GET', url: '/api/tenant/categories', response: { success: true, categories } },
    { method: 'POST', url: '/api/tenant/categories', body: ['name', 'description', 'color', 'sortOrder', 'isActive'], response: { success: true, category } },
    { method: 'PUT', url: '/api/tenant/categories/:id', body: ['name', 'description', 'color', 'sortOrder', 'isActive'], response: { success: true, category } },
    { method: 'DELETE', url: '/api/tenant/categories/:id', response: { success: true, message: 'Category deleted' } },
  ],

  // ==========================================
  // PRODUCT ENDPOINTS (4 endpoints)
  // ==========================================
  PRODUCTS: [
    { method: 'GET', url: '/api/tenant/products', params: ['categoryId'], response: { success: true, products } },
    { method: 'POST', url: '/api/tenant/products', body: ['name', 'description', 'price', 'categoryId', 'image', 'isAvailable', 'taxPercent', 'variants'], response: { success: true, product } },
    { method: 'PUT', url: '/api/tenant/products/:productId', body: ['name', 'description', 'price', 'categoryId', 'image', 'isAvailable', 'taxPercent', 'variants'], response: { success: true, product } },
    { method: 'DELETE', url: '/api/tenant/products/:id', response: { success: true, message: 'Product deleted' } },
  ],

  // ==========================================
  // SALES/REPORTS ENDPOINTS (5 endpoints)
  // ==========================================
  SALES: [
    { method: 'GET', url: '/api/tenant/sales/daily', params: ['date'], response: { success: true, sales } },
    { method: 'GET', url: '/api/tenant/sales/categories', params: ['startDate', 'endDate'], response: { success: true, categorySales } },
    { method: 'GET', url: '/api/tenant/sales/items', params: ['startDate', 'endDate'], response: { success: true, itemSales } },
    { method: 'GET', url: '/api/tenant/sales/payments', params: ['startDate', 'endDate'], response: { success: true, paymentSales } },
    { method: 'GET', url: '/api/tenant/sales/dashboard', response: { success: true, salesStats } },
  ],

  // ==========================================
  // PURCHASE ENDPOINTS (2 endpoints)
  // ==========================================
  PURCHASES: [
    { method: 'GET', url: '/api/tenant/purchases', response: { success: true, purchases } },
    { method: 'POST', url: '/api/tenant/purchases', body: ['supplierId', 'items', 'totalAmount', 'purchaseDate', 'invoiceNumber'], response: { success: true, purchase } },
  ],

  // ==========================================
  // INVENTORY SALE ENDPOINTS (2 endpoints)
  // ==========================================
  INVENTORY_SALES: [
    { method: 'GET', url: '/api/tenant/inventory-sales', response: { success: true, sales } },
    { method: 'POST', url: '/api/tenant/inventory-sales', body: ['inventoryItemId', 'quantity', 'salePrice', 'saleDate', 'customerName'], response: { success: true, sale } },
  ],

  // ==========================================
  // RAW INVENTORY ITEMS ENDPOINTS (4 endpoints)
  // ==========================================
  INVENTORY_ITEMS: [
    { method: 'GET', url: '/api/tenant/inventory/items', response: { success: true, items } },
    { method: 'POST', url: '/api/tenant/inventory/items', body: ['name', 'description', 'unit', 'categoryId', 'currentStock', 'minStockLevel', 'reorderPoint', 'costPerUnit', 'supplierId'], response: { success: true, item } },
    { method: 'PUT', url: '/api/tenant/inventory/items/:id', body: ['name', 'description', 'unit', 'categoryId', 'currentStock', 'minStockLevel', 'reorderPoint', 'costPerUnit', 'supplierId'], response: { success: true, item } },
    { method: 'DELETE', url: '/api/tenant/inventory/items/:id', response: { success: true, message: 'Item deleted' } },
  ],

  // ==========================================
  // INVENTORY CATEGORIES ENDPOINTS (5 endpoints)
  // ==========================================
  INVENTORY_CATEGORIES: [
    { method: 'GET', url: '/api/tenant/inventory-categories', response: { success: true, categories } },
    { method: 'POST', url: '/api/tenant/inventory-categories', body: ['name', 'description', 'color', 'parentCategoryId', 'minStockAlert', 'maxStockAlert'], response: { success: true, category } },
    { method: 'PUT', url: '/api/tenant/inventory-categories/:id', body: ['name', 'description', 'color', 'parentCategoryId', 'minStockAlert', 'maxStockAlert'], response: { success: true, category } },
    { method: 'DELETE', url: '/api/tenant/inventory-categories/:id', response: { success: true, message: 'Category deleted' } },
    { method: 'PUT', url: '/api/tenant/inventory-categories/:id/status', body: ['status'], response: { success: true, category } },
  ],

  // ==========================================
  // RECIPE ENDPOINTS (7 endpoints)
  // ==========================================
  RECIPES: [
    { method: 'GET', url: '/api/tenant/recipes', response: { success: true, recipes } },
    { method: 'GET', url: '/api/tenant/recipes/:id', response: { success: true, recipe } },
    { method: 'POST', url: '/api/tenant/recipes', body: ['name', 'description', 'productId', 'ingredients', 'instructions', 'prepTime', 'cookTime', 'servingSize'], response: { success: true, recipe } },
    { method: 'PUT', url: '/api/tenant/recipes/:id', body: ['name', 'description', 'productId', 'ingredients', 'instructions', 'prepTime', 'cookTime', 'servingSize'], response: { success: true, recipe } },
    { method: 'DELETE', url: '/api/tenant/recipes/:id', response: { success: true, message: 'Recipe deleted' } },
    { method: 'GET', url: '/api/tenant/recipes/:id/availability', response: { success: true, available, missingIngredients } },
    { method: 'GET', url: '/api/tenant/recipes/:id/cost-analysis', response: { success: true, totalCost, costPerServing, suggestedPrice, profitMargin } },
  ],

  // ==========================================
  // WASTAGE ENDPOINTS (3 endpoints)
  // ==========================================
  WASTAGE: [
    { method: 'GET', url: '/api/tenant/inventory/wastage', response: { success: true, wastageRecords } },
    { method: 'POST', url: '/api/tenant/inventory/wastage', body: ['inventoryItemId', 'quantity', 'reason', 'wastageDate', 'notes'], response: { success: true, wastage } },
    { method: 'DELETE', url: '/api/tenant/inventory/wastage/:id', response: { success: true, message: 'Wastage record deleted' } },
  ],

  // ==========================================
  // STOCK ADJUSTMENT ENDPOINTS (8 endpoints)
  // ==========================================
  STOCK_ADJUSTMENTS: [
    { method: 'POST', url: '/api/tenant/inventory/purchase', body: ['inventoryItemId', 'quantity', 'costPerUnit', 'purchaseDate', 'supplierId', 'invoiceNumber'], response: { success: true, purchase } },
    { method: 'POST', url: '/api/tenant/inventory/self-consume', body: ['inventoryItemId', 'quantity', 'consumeDate', 'reason', 'recipeId'], response: { success: true, consumption } },
    { method: 'POST', url: '/api/tenant/inventory/adjust', body: ['inventoryItemId', 'quantity', 'adjustmentType', 'reason', 'adjustmentDate'], response: { success: true, adjustment } },
    { method: 'GET', url: '/api/tenant/inventory/adjustments', response: { success: true, adjustments } },
    { method: 'POST', url: '/api/tenant/inventory/adjustments', body: ['inventoryItemId', 'quantity', 'adjustmentType', 'reason', 'adjustmentDate'], response: { success: true, adjustment } },
    { method: 'GET', url: '/api/tenant/inventory/transactions', params: ['inventoryItemId', 'startDate', 'endDate', 'type'], response: { success: true, transactions } },
    { method: 'GET', url: '/api/tenant/inventory/low-stock', response: { success: true, lowStockItems } },
  ],

  // ==========================================
  // STAFF/USERS ENDPOINTS (3 endpoints)
  // ==========================================
  STAFF: [
    { method: 'GET', url: '/api/tenant/users', response: { success: true, users } },
    { method: 'POST', url: '/api/tenant/users', body: ['name', 'email', 'phone', 'role', 'password', 'outletId'], response: { success: true, user } },
  ],

  // ==========================================
  // ACCOUNTING ENDPOINTS (6 endpoints)
  // ==========================================
  ACCOUNTING: [
    { method: 'GET', url: '/api/tenant/accounting/accounts', response: { success: true, accounts } },
    { method: 'POST', url: '/api/tenant/accounting/accounts', body: ['name', 'type', 'openingBalance', 'currentBalance', 'description'], response: { success: true, account } },
    { method: 'PUT', url: '/api/tenant/accounting/accounts/:id', body: ['name', 'type', 'openingBalance', 'description'], response: { success: true, account } },
    { method: 'DELETE', url: '/api/tenant/accounting/accounts/:id', response: { success: true, message: 'Account deleted' } },
    { method: 'GET', url: '/api/tenant/accounting/transactions', params: ['accountId', 'startDate', 'endDate', 'type'], response: { success: true, transactions } },
    { method: 'POST', url: '/api/tenant/accounting/transactions', body: ['accountId', 'type', 'amount', 'description', 'transactionDate', 'referenceNumber', 'category'], response: { success: true, transaction } },
  ],

  // ==========================================
  // DASHBOARD ENDPOINTS (2 endpoints)
  // ==========================================
  DASHBOARD: [
    { method: 'GET', url: '/api/tenant/dashboard', params: ['period', 'startDate', 'endDate'], response: { success: true, stats } },
    { method: 'GET', url: '/api/tenant/sales/dashboard', response: { success: true, salesStats } },
  ],

  // ==========================================
  // TIMING ENDPOINTS (2 endpoints)
  // ==========================================
  TIMINGS: [
    { method: 'GET', url: '/api/tenant/timing', response: { success: true, timings } },
    { method: 'POST', url: '/api/tenant/timing', body: ['day', 'openTime', 'closeTime', 'isOpen', 'specialHours'], response: { success: true, timing } },
  ],

  // ==========================================
  // PRODUCT TYPE ENDPOINTS (2 endpoints)
  // ==========================================
  PRODUCT_TYPES: [
    { method: 'GET', url: '/api/tenant/product-types', response: { success: true, productTypes } },
    { method: 'POST', url: '/api/tenant/product-types', body: ['name', 'description'], response: { success: true, productType } },
  ],

  // ==========================================
  // EXPENSE TYPE ENDPOINTS (4 endpoints)
  // ==========================================
  EXPENSE_TYPES: [
    { method: 'GET', url: '/api/tenant/expense-types', response: { success: true, expenseTypes } },
    { method: 'POST', url: '/api/tenant/expense-types', body: ['name', 'description', 'isActive'], response: { success: true, expenseType } },
    { method: 'PUT', url: '/api/tenant/expense-types/:id', body: ['name', 'description', 'isActive'], response: { success: true, expenseType } },
    { method: 'DELETE', url: '/api/tenant/expense-types/:id', response: { success: true, message: 'Expense type deleted' } },
  ],

  // ==========================================
  // TABLES MANAGEMENT ENDPOINTS (4 endpoints)
  // ==========================================
  TABLES_MANAGEMENT: [
    { method: 'GET', url: '/api/tenant/tables-management', params: ['areaId', 'status', 'date'], response: { success: true, tables } },
    { method: 'POST', url: '/api/tenant/tables-management', body: ['tableNumber', 'capacity', 'areaId', 'shape', 'position'], response: { success: true, table } },
    { method: 'PUT', url: '/api/tenant/tables-management/:id', body: ['tableNumber', 'capacity', 'areaId', 'shape', 'position', 'status'], response: { success: true, table } },
    { method: 'DELETE', url: '/api/tenant/tables-management/:id', response: { success: true, message: 'Table deleted' } },
  ],

  // ==========================================
  // LIVE FEEDING ENDPOINTS (2 endpoints)
  // ==========================================
  LIVE_FEEDING: [
    { method: 'GET', url: '/api/tenant/live-orders', response: { success: true, liveOrders } },
    { method: 'GET', url: '/api/tenant/live-stats', response: { success: true, stats } },
  ],

  // ==========================================
  // SUPPLIER ENDPOINTS (4 endpoints)
  // ==========================================
  SUPPLIERS: [
    { method: 'GET', url: '/api/tenant/inventory/suppliers', response: { success: true, suppliers } },
    { method: 'POST', url: '/api/tenant/inventory/suppliers', body: ['name', 'contactPerson', 'email', 'phone', 'address', 'gstNumber', 'paymentTerms'], response: { success: true, supplier } },
    { method: 'PUT', url: '/api/tenant/inventory/suppliers/:id', body: ['name', 'contactPerson', 'email', 'phone', 'address', 'gstNumber', 'paymentTerms'], response: { success: true, supplier } },
    { method: 'DELETE', url: '/api/tenant/inventory/suppliers/:id', response: { success: true, message: 'Supplier deleted' } },
  ],

  // ==========================================
  // CONTROL CENTER ENDPOINTS (2 endpoints)
  // ==========================================
  CONTROL_CENTER: [
    { method: 'GET', url: '/api/tenant/control-center', response: { success: true, stats } },
    { method: 'GET', url: '/api/tenant/system-health', response: { success: true, health } },
  ],

  // ==========================================
  // BILLING CONFIG ENDPOINTS (3 endpoints)
  // ==========================================
  BILLING_CONFIG: [
    { method: 'GET', url: '/api/tenant/billing/config', response: { success: true, config } },
    { method: 'PUT', url: '/api/tenant/billing/config', body: ['businessName', 'address', 'phone', 'email', 'gstNumber', 'taxPercent', 'receiptFooter'], response: { success: true, config } },
    { method: 'PATCH', url: '/api/tenant/billing/config', body: ['...partialConfig'], response: { success: true, config } },
  ],

  // ==========================================
  // BUSINESS ENDPOINTS (2 endpoints)
  // ==========================================
  BUSINESS: [
    { method: 'GET', url: '/api/tenant/business', response: { success: true, business } },
    { method: 'PUT', url: '/api/tenant/business', body: ['name', 'address', 'phone', 'email', 'gstNumber', 'logo'], response: { success: true, business } },
  ],
};

// ==========================================
// BACKEND ROUTES STATUS
// ==========================================

const BACKEND_ROUTES_STATUS = {
  // EXISTING ROUTES (Found in routes/)
  EXISTING: [
    '/api/auth/*',              // auth.routes.js
    '/api/onboarding/business', // onboardingRoute.js
    '/api/super-admin/*',       // superAdminRoute.js
    '/api/admin/*',             // adminRoute.js
    '/api/user/*',              // userRoute.js
    '/api/upload/*',            // uploadRoute.js
    '/api/tenant/categories',   // tenant/category.routes.js
    '/api/inventory/*',         // inventoryRoutes.js
    '/api/tenant/accounting/*', // accountingRoute.js
  ],

  // MISSING ROUTES (Need to create)
  MISSING: [
    // Tenant Profile
    '/api/tenant/profile',              // GET, PUT
    
    // Tables
    '/api/tenant/tables',               // POST, GET, PUT, DELETE
    
    // Areas
    '/api/tenant/areas',                // POST, GET, PUT, DELETE
    
    // Operation Timings
    '/api/tenant/operation-timings',    // GET, POST, PUT, DELETE
    
    // Outlets
    '/api/tenant/outlets',              // POST, GET, PUT
    
    // Payments
    '/api/tenant/payments/*',           // POST
    
    // Orders
    '/api/tenant/orders',               // POST, GET
    '/api/tenant/orders/archived',      // GET
    '/api/tenant/ebill/send',           // POST
    
    // Sales
    '/api/tenant/sales/*',              // GET
    
    // Purchases
    '/api/tenant/purchases',            // GET, POST
    
    // Inventory Sales
    '/api/tenant/inventory-sales',      // GET, POST
    
    // Raw Inventory Items
    '/api/tenant/inventory/items',      // GET, POST, PUT, DELETE
    
    // Inventory Categories
    '/api/tenant/inventory-categories', // GET, POST, PUT, DELETE
    
    // Recipes
    '/api/tenant/recipes',              // GET, POST, PUT, DELETE
    
    // Wastage
    '/api/tenant/inventory/wastage',    // GET, POST, DELETE
    
    // Stock Adjustments
    '/api/tenant/inventory/purchase',   // POST
    '/api/tenant/inventory/self-consume', // POST
    '/api/tenant/inventory/adjust',     // POST
    '/api/tenant/inventory/adjustments', // GET, POST
    '/api/tenant/inventory/transactions', // GET
    '/api/tenant/inventory/low-stock',  // GET
    
    // Staff/Users
    '/api/tenant/users',                // GET, POST
    
    // Dashboard
    '/api/tenant/dashboard',            // GET
    
    // Timings
    '/api/tenant/timing',               // GET, POST
    
    // Product Types
    '/api/tenant/product-types',        // GET, POST
    
    // Expense Types
    '/api/tenant/expense-types',        // GET, POST, PUT, DELETE
    
    // Tables Management
    '/api/tenant/tables-management',    // GET, POST, PUT, DELETE
    
    // Live Feeding
    '/api/tenant/live-orders',          // GET
    '/api/tenant/live-stats',           // GET
    
    // Suppliers
    '/api/tenant/inventory/suppliers',  // GET, POST, PUT, DELETE
    
    // Control Center
    '/api/tenant/control-center',       // GET
    '/api/tenant/system-health',        // GET
    
    // Billing Config
    '/api/tenant/billing/config',       // GET, PUT, PATCH
    
    // Business
    '/api/tenant/business',             // GET, PUT
  ]
};

module.exports = { FRONTEND_APIS, BACKEND_ROUTES_STATUS };
