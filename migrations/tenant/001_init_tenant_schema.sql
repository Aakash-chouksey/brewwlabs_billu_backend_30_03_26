-- Tenant Database Initialization
-- Contains POS operational data for each brand/business

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core Tables
-- Outlets table for multi-location businesses
CREATE TABLE IF NOT EXISTS outlets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    business_name VARCHAR(255),
    profile_image_url VARCHAR(255) DEFAULT '',
    address TEXT,
    contact_number VARCHAR(50),
    timings_open VARCHAR(50) DEFAULT '09:00 AM',
    timings_close VARCHAR(50) DEFAULT '11:00 PM',
    is_active BOOLEAN DEFAULT true,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outlets_business ON outlets(businessId);
CREATE INDEX IF NOT EXISTS idx_outlets_active ON outlets(is_active);

-- Users table for staff management
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(512) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Cashier',
    primary_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    phone VARCHAR(50),
    isActive BOOLEAN DEFAULT TRUE,
    tokenVersion INTEGER DEFAULT 0,
    lastLogin TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_business ON users(businessId);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_primary_outlet ON users(primary_outlet_id);

-- User-Outlet mapping table for permissions
CREATE TABLE IF NOT EXISTS user_outlets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_user_outlets_user ON user_outlets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_outlets_outlet ON user_outlets(outlet_id);
CREATE INDEX IF NOT EXISTS idx_user_outlets_active ON user_outlets(user_id, is_active);

-- Roles table for role-based permissions
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    permissions JSONB DEFAULT '[]',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(businessId, name)
);

CREATE INDEX IF NOT EXISTS idx_roles_business ON roles(businessId);

-- Terminals table for POS devices
CREATE TABLE IF NOT EXISTS terminals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    outletId UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    serial_number VARCHAR(255),
    terminal_type VARCHAR(50) DEFAULT 'POS',
    is_active BOOLEAN DEFAULT TRUE,
    last_active TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terminals_business ON terminals(businessId);
CREATE INDEX IF NOT EXISTS idx_terminals_outlet ON terminals(outletId);
CREATE INDEX IF NOT EXISTS idx_terminals_active ON terminals(is_active);

-- Menu System
-- Categories for menu organization
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    outletId UUID REFERENCES outlets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7),
    image VARCHAR(500),
    isEnabled BOOLEAN DEFAULT TRUE,
    sortOrder INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(businessId, outletId, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_business ON categories(businessId);
CREATE INDEX IF NOT EXISTS idx_categories_outlet ON categories(outletId);
CREATE INDEX IF NOT EXISTS idx_categories_business_outlet ON categories(businessId, outletId);
CREATE INDEX IF NOT EXISTS idx_categories_business_outlet_enabled ON categories(businessId, outletId, isEnabled);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    outletId UUID REFERENCES outlets(id) ON DELETE CASCADE,
    categoryId UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    cost DECIMAL(10,2) DEFAULT 0.00,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    image VARCHAR(500),
    productType VARCHAR(50) DEFAULT 'simple',
    isAvailable BOOLEAN DEFAULT TRUE,
    trackStock BOOLEAN DEFAULT FALSE,
    stock INTEGER DEFAULT 0,
    minStockLevel INTEGER DEFAULT 0,
    maxStockLevel INTEGER DEFAULT NULL,
    unit VARCHAR(50) DEFAULT 'pcs',
    taxRate DECIMAL(5,4) DEFAULT 0.0000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(businessId, outletId, name)
);

CREATE INDEX IF NOT EXISTS idx_products_business ON products(businessId);
CREATE INDEX IF NOT EXISTS idx_products_outlet ON products(outletId);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(categoryId);
CREATE INDEX IF NOT EXISTS idx_products_business_outlet ON products(businessId, outletId);
CREATE INDEX IF NOT EXISTS idx_products_business_outlet_category ON products(businessId, outletId, categoryId);
CREATE INDEX IF NOT EXISTS idx_products_business_outlet_available ON products(businessId, outletId, isAvailable);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- Product variants for size/color variations
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    productId UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    businessId UUID NOT NULL,
    outletId UUID REFERENCES outlets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    cost DECIMAL(10,2) DEFAULT 0.00,
    stock INTEGER DEFAULT 0,
    isAvailable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(productId);
CREATE INDEX IF NOT EXISTS idx_product_variants_business ON product_variants(businessId);
CREATE INDEX IF NOT EXISTS idx_product_variants_outlet ON product_variants(outletId);

-- Modifiers for product options
CREATE TABLE IF NOT EXISTS modifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    modifierType VARCHAR(50) DEFAULT 'single', -- single, multiple, required
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    isAvailable BOOLEAN DEFAULT TRUE,
    sortOrder INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modifiers_business ON modifiers(businessId);

-- Product-modifier relationships
CREATE TABLE IF NOT EXISTS product_modifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    productId UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    modifierId UUID NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
    businessId UUID NOT NULL,
    sortOrder INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(productId, modifierId)
);

CREATE INDEX IF NOT EXISTS idx_product_modifiers_product ON product_modifiers(productId);
CREATE INDEX IF NOT EXISTS idx_product_modifiers_modifier ON product_modifiers(modifierId);
CREATE INDEX IF NOT EXISTS idx_product_modifiers_business ON product_modifiers(businessId);

-- Tables & Seating
-- Tables for restaurant seating
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    outletId UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    tableType VARCHAR(50) DEFAULT 'standard', -- standard, booth, bar, outdoor
    positionX DECIMAL(8,2),
    positionY DECIMAL(8,2),
    isAvailable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tables_business ON tables(businessId);
CREATE INDEX IF NOT EXISTS idx_tables_outlet ON tables(outletId);
CREATE INDEX IF NOT EXISTS idx_tables_available ON tables(isAvailable);

-- Customers & Loyalty
-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    birthDate DATE,
    gender VARCHAR(20),
    loyaltyPoints INTEGER DEFAULT 0,
    totalSpent DECIMAL(10,2) DEFAULT 0.00,
    visitCount INTEGER DEFAULT 0,
    lastVisitAt TIMESTAMPTZ,
    isActive BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(businessId);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_loyalty ON customers(loyaltyPoints);

-- Orders
-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL,
    outletId UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    tableId UUID REFERENCES tables(id) ON DELETE SET NULL,
    orderNumber VARCHAR(50) NOT NULL,
    orderType VARCHAR(50) DEFAULT 'dine_in', -- dine_in, takeaway, delivery, online
    status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, preparing, ready, completed, cancelled
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    taxAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discountAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    totalAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    customerId UUID,
    waiterId UUID REFERENCES users(id) ON DELETE SET NULL,
    terminalId UUID REFERENCES terminals(id) ON DELETE SET NULL,
    notes TEXT,
    orderDate TIMESTAMPTZ DEFAULT NOW(),
    completedAt TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_brand ON orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_orders_outlet ON orders(outletId);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(tableId);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(orderDate);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(orderNumber);

-- Table sessions for tracking occupied tables
CREATE TABLE IF NOT EXISTS table_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tableId UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    businessId UUID NOT NULL,
    orderId UUID REFERENCES orders(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'occupied', -- occupied, available, reserved
    startTime TIMESTAMPTZ DEFAULT NOW(),
    endTime TIMESTAMPTZ,
    guests INTEGER DEFAULT 1,
    waiterId UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_sessions_table ON table_sessions(tableId);
CREATE INDEX IF NOT EXISTS idx_table_sessions_business ON table_sessions(businessId);
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orderId UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL,
    productId UUID REFERENCES products(id) ON DELETE SET NULL,
    productVariantId UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
    unitPrice DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    totalPrice DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    cost DECIMAL(10,2) DEFAULT 0.00,
    notes TEXT,
    sortOrder INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(orderId);
CREATE INDEX IF NOT EXISTS idx_order_items_brand ON order_items(brand_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(productId);
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items(productVariantId);

-- Order item modifiers
CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orderItemId UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    businessId UUID NOT NULL,
    modifierId UUID REFERENCES modifiers(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_item ON order_item_modifiers(orderItemId);
CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_business ON order_item_modifiers(businessId);
CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_modifier ON order_item_modifiers(modifierId);

-- Order status history
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orderId UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    businessId UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    changedBy UUID REFERENCES users(id) ON DELETE SET NULL,
    changedAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(orderId);
CREATE INDEX IF NOT EXISTS idx_order_status_history_business ON order_status_history(businessId);
CREATE INDEX IF NOT EXISTS idx_order_status_history_status ON order_status_history(status);

-- Payments
-- Payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- cash, card, mobile, wallet, gift_card
    isEnabled BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}', -- payment gateway config
    sortOrder INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_business ON payment_methods(businessId);
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_enabled ON payment_methods(isEnabled);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orderId UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    businessId UUID NOT NULL,
    paymentMethodId UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    paymentType VARCHAR(50) NOT NULL, -- cash, card, mobile, wallet, etc.
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed, refunded
    transactionId VARCHAR(255),
    referenceNumber VARCHAR(255),
    notes TEXT,
    processedAt TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(orderId);
CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(businessId);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(paymentType);
CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments(transactionId);

-- Refunds table
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paymentId UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    businessId UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processed, failed
    processedBy UUID REFERENCES users(id) ON DELETE SET NULL,
    processedAt TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(paymentId);
CREATE INDEX IF NOT EXISTS idx_refunds_business ON refunds(businessId);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- Inventory Categories
CREATE TABLE IF NOT EXISTS inventory_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(brand_id, outlet_id, name)
);

CREATE INDEX IF NOT EXISTS idx_inventory_categories_brand ON inventory_categories(brand_id);
CREATE INDEX IF NOT EXISTS idx_inventory_categories_outlet ON inventory_categories(outlet_id);

-- Inventory items
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    inventory_category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    current_stock DECIMAL(10,3) NOT NULL DEFAULT 0,
    minimum_stock DECIMAL(10,3) DEFAULT 0,
    max_stock_level DECIMAL(10,3),
    unit VARCHAR(50),
    unit_cost DECIMAL(10,2) DEFAULT 0.00,
    last_counted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(brand_id, outlet_id, name)
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_brand ON inventory_items(brand_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_outlet ON inventory_items(outlet_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(inventory_category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_product ON inventory_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku);

-- Recipes
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    instructions TEXT,
    prep_time INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(brand_id, outlet_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_recipes_brand_outlet ON recipes(brand_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes(product_id);

-- Recipe items
CREATE TABLE IF NOT EXISTS recipe_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity_required DECIMAL(10,3) NOT NULL,
    unit VARCHAR(50),
    is_optional BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(recipe_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_inventory ON recipe_items(inventory_item_id);

-- Inventory transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- PURCHASE, SALE, ADJUSTMENT, WASTAGE, SELF_CONSUME
    quantity DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(10,2) DEFAULT 0.00,
    reference_id UUID, -- can reference orders, purchases, etc.
    reason TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_brand ON inventory_transactions(brand_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_outlet ON inventory_transactions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON inventory_transactions(created_at);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    contactPerson VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    taxId VARCHAR(100),
    paymentTerms VARCHAR(100),
    notes TEXT,
    isActive BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_business ON suppliers(businessId);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(isActive);

-- Purchases
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    supplierId UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    outletId UUID REFERENCES outlets(id) ON DELETE CASCADE,
    purchaseNumber VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, received, cancelled
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    taxAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    totalAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    purchaseDate TIMESTAMPTZ DEFAULT NOW(),
    expectedDeliveryDate TIMESTAMPTZ,
    receivedDate TIMESTAMPTZ,
    notes TEXT,
    createdBy UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_business ON purchases(businessId);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplierId);
CREATE INDEX IF NOT EXISTS idx_purchases_outlet ON purchases(outletId);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchaseDate);

-- Purchase items
CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchaseId UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    businessId UUID NOT NULL,
    productId UUID REFERENCES products(id) ON DELETE SET NULL,
    productVariantId UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
    unitPrice DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    totalPrice DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    receivedQuantity DECIMAL(10,3) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchaseId);
CREATE INDEX IF NOT EXISTS idx_purchase_items_business ON purchase_items(businessId);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(productId);

-- Accounting
-- Expense types
CREATE TABLE IF NOT EXISTS expense_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- food, labor, utilities, maintenance, etc.
    isDeductible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(businessId, name)
);

CREATE INDEX IF NOT EXISTS idx_expense_types_business ON expense_types(businessId);
CREATE INDEX IF NOT EXISTS idx_expense_types_category ON expense_types(category);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    outletId UUID REFERENCES outlets(id) ON DELETE SET NULL,
    expenseTypeId UUID REFERENCES expense_types(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    receiptImage VARCHAR(500),
    expenseDate TIMESTAMPTZ DEFAULT NOW(),
    approvedBy UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_business ON expenses(businessId);
CREATE INDEX IF NOT EXISTS idx_expenses_outlet ON expenses(outletId);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expenseTypeId);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expenseDate);

-- Cash register sessions
CREATE TABLE IF NOT EXISTS cash_register_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    outletId UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    terminalId UUID REFERENCES terminals(id) ON DELETE SET NULL,
    openingBalance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    closingBalance DECIMAL(10,2),
    cashSales DECIMAL(10,2) DEFAULT 0.00,
    cardSales DECIMAL(10,2) DEFAULT 0.00,
    otherSales DECIMAL(10,2) DEFAULT 0.00,
    expectedCash DECIMAL(10,2),
    actualCash DECIMAL(10,2),
    variance DECIMAL(10,2),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'open', -- open, closed
    openedAt TIMESTAMPTZ DEFAULT NOW(),
    closedAt TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_register_sessions_business ON cash_register_sessions(businessId);
CREATE INDEX IF NOT EXISTS idx_cash_register_sessions_outlet ON cash_register_sessions(outletId);
CREATE INDEX IF NOT EXISTS idx_cash_register_sessions_user ON cash_register_sessions(userId);
CREATE INDEX IF NOT EXISTS idx_cash_register_sessions_status ON cash_register_sessions(status);

-- Loyalty accounts
CREATE TABLE IF NOT EXISTS loyalty_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    customerId UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    accountNumber VARCHAR(100) UNIQUE,
    points INTEGER DEFAULT 0,
    tier VARCHAR(50) DEFAULT 'bronze', -- bronze, silver, gold, platinum
    isActive BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_business ON loyalty_accounts(businessId);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_customer ON loyalty_accounts(customerId);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_number ON loyalty_accounts(accountNumber);

-- Loyalty transactions
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    customerId UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    transactionType VARCHAR(50) NOT NULL, -- earned, redeemed, expired, adjusted
    points INTEGER NOT NULL,
    orderId UUID REFERENCES orders(id) ON DELETE SET NULL,
    description TEXT,
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_business ON loyalty_transactions(businessId);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer ON loyalty_transactions(customerId);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_type ON loyalty_transactions(transactionType);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_date ON loyalty_transactions(createdAt);

-- Promotions
-- Promotions
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- discount, buy_one_get_one, free_item, points_multiplier
    discountType VARCHAR(50), -- percentage, fixed_amount, free_item
    discountValue DECIMAL(10,2),
    minOrderAmount DECIMAL(10,2) DEFAULT 0.00,
    maxDiscountAmount DECIMAL(10,2),
    startDate TIMESTAMPTZ NOT NULL,
    endDate TIMESTAMPTZ NOT NULL,
    usageLimit INTEGER,
    usageCount INTEGER DEFAULT 0,
    isActive BOOLEAN DEFAULT TRUE,
    applicableDays JSONB DEFAULT '[]', -- [1,2,3,4,5,6,7] for days of week
    applicableHours JSONB DEFAULT '{}', -- {"start": "09:00", "end": "22:00"}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_business ON promotions(businessId);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(isActive);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(startDate, endDate);
CREATE INDEX IF NOT EXISTS idx_promotions_type ON promotions(type);

-- Promotion products
CREATE TABLE IF NOT EXISTS promotion_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    promotionId UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    businessId UUID NOT NULL,
    productId UUID REFERENCES products(id) ON DELETE CASCADE,
    productVariantId UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    discountType VARCHAR(50), -- percentage, fixed_amount
    discountValue DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(promotionId, productId, productVariantId)
);

CREATE INDEX IF NOT EXISTS idx_promotion_products_promotion ON promotion_products(promotionId);
CREATE INDEX IF NOT EXISTS idx_promotion_products_business ON promotion_products(businessId);
CREATE INDEX IF NOT EXISTS idx_promotion_products_product ON promotion_products(productId);

-- Analytics
-- Daily sales summary
CREATE TABLE IF NOT EXISTS daily_sales_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    outletId UUID REFERENCES outlets(id) ON DELETE CASCADE,
    summaryDate DATE NOT NULL,
    totalOrders INTEGER DEFAULT 0,
    totalRevenue DECIMAL(10,2) DEFAULT 0.00,
    totalTax DECIMAL(10,2) DEFAULT 0.00,
    totalDiscount DECIMAL(10,2) DEFAULT 0.00,
    cashRevenue DECIMAL(10,2) DEFAULT 0.00,
    cardRevenue DECIMAL(10,2) DEFAULT 0.00,
    otherRevenue DECIMAL(10,2) DEFAULT 0.00,
    customerCount INTEGER DEFAULT 0,
    averageOrderValue DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(businessId, outletId, summaryDate)
);

CREATE INDEX IF NOT EXISTS idx_daily_sales_summary_business ON daily_sales_summary(businessId);
CREATE INDEX IF NOT EXISTS idx_daily_sales_summary_outlet ON daily_sales_summary(outletId);
CREATE INDEX IF NOT EXISTS idx_daily_sales_summary_date ON daily_sales_summary(summaryDate);

-- Product sales summary
CREATE TABLE IF NOT EXISTS product_sales_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    outletId UUID REFERENCES outlets(id) ON DELETE CASCADE,
    productId UUID REFERENCES products(id) ON DELETE CASCADE,
    productVariantId UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    summaryDate DATE NOT NULL,
    totalQuantity DECIMAL(10,3) DEFAULT 0,
    totalRevenue DECIMAL(10,2) DEFAULT 0.00,
    totalCost DECIMAL(10,2) DEFAULT 0.00,
    grossProfit DECIMAL(10,2) DEFAULT 0.00,
    orderCount INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(businessId, outletId, productId, productVariantId, summaryDate)
);

CREATE INDEX IF NOT EXISTS idx_product_sales_summary_business ON product_sales_summary(businessId);
CREATE INDEX IF NOT EXISTS idx_product_sales_summary_outlet ON product_sales_summary(outletId);
CREATE INDEX IF NOT EXISTS idx_product_sales_summary_product ON product_sales_summary(productId);
CREATE INDEX IF NOT EXISTS idx_product_sales_summary_date ON product_sales_summary(summaryDate);

-- Logs
-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    userId UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entityType VARCHAR(100),
    entityId UUID,
    oldValues JSONB,
    newValues JSONB,
    ipAddress VARCHAR(45),
    userAgent TEXT,
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON audit_logs(businessId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(userId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entityType, entityId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(createdAt);

-- System logs
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID,
    level VARCHAR(20) NOT NULL, -- debug, info, warn, error, fatal
    message TEXT NOT NULL,
    context JSONB,
    stackTrace TEXT,
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_business ON system_logs(businessId);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_date ON system_logs(createdAt);

-- Notifications
-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    userId UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    isRead BOOLEAN DEFAULT FALSE,
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    expiresAt TIMESTAMPTZ,
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_business ON notifications(businessId);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(isRead);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_date ON notifications(createdAt);

-- Notification templates
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    businessId UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    subject VARCHAR(255),
    template TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    isActive BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(businessId, name)
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_business ON notification_templates(businessId);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(isActive);

-- Add comments for documentation
COMMENT ON TABLE outlets IS 'Business locations/stores';
COMMENT ON TABLE users IS 'Staff and user accounts';
COMMENT ON TABLE user_outlets IS 'User permissions for specific outlets';
COMMENT ON TABLE roles IS 'Role-based access control';
COMMENT ON TABLE terminals IS 'POS devices and terminals';
COMMENT ON TABLE categories IS 'Menu categories with outlet scoping';
COMMENT ON TABLE products IS 'Menu items with outlet scoping';
COMMENT ON TABLE product_variants IS 'Product variations (size, color, etc.)';
COMMENT ON TABLE modifiers IS 'Product options and add-ons';
COMMENT ON TABLE tables IS 'Restaurant seating tables';
COMMENT ON TABLE orders IS 'Customer orders';
COMMENT ON TABLE payments IS 'Payment transactions';
COMMENT ON TABLE inventory_items IS 'Stock levels and inventory';
COMMENT ON TABLE customers IS 'Customer database';
COMMENT ON TABLE promotions IS 'Marketing promotions';
COMMENT ON TABLE audit_logs IS 'User activity tracking';

COMMIT;
