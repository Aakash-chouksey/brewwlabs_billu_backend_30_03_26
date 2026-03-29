/**
 * SCHEMA CREATION SERVICE
 * Creates complete tenant schema in ONE STEP - NO MIGRATIONS during onboarding
 * 
 * This service creates all tables with FULL structure immediately,
 * eliminating the need for incremental migrations during tenant creation.
 */

const { Sequelize } = require('sequelize');

class SchemaCreationService {
    constructor() {
        this.requiredTables = [
            'outlets', 'accounts', 'table_areas', 'billing_configs', 'categories',
            'customers', 'customer_ledger', 'customer_transactions', 'expenses',
            'expense_types', 'feature_flags', 'incomes', 'inventory', 'inventory_categories',
            'inventory_items', 'inventory_sales', 'inventory_transactions', 'membership_plans',
            'operation_timings', 'orders', 'order_items', 'partner_memberships',
            'partner_types', 'partner_wallets', 'payments', 'products', 'product_types',
            'purchases', 'purchase_items', 'recipes', 'recipe_items', 'roll_trackings',
            'settings', 'stock_transactions', 'suppliers', 'tables', 'audit_logs',
            'timings', 'account_transactions', 'wastages', 'web_contents', 'schema_versions'
        ];
    }

    /**
     * Create COMPLETE schema in ONE transaction
     * NO migrations - all tables created with full structure immediately
     */
    async createCompleteSchema(sequelize, schemaName, businessId, outletId) {
        const startTime = Date.now();
        console.log(`[SchemaCreationService] 🚀 Creating COMPLETE schema: ${schemaName}`);

        const transaction = await sequelize.transaction();

        try {
            // 1. Create schema
            await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`, { transaction });
            console.log(`[SchemaCreationService] ✅ Schema created: ${schemaName}`);

            // 2. Create schema_versions table FIRST (needed for tracking)
            await this._createSchemaVersionsTable(sequelize, schemaName, transaction);

            // 3. Create ALL tables with COMPLETE structure
            await this._createAllTables(sequelize, schemaName, transaction);

            // 4. Create ALL indexes (constraints are inline in table creation)
            await this._createIndexes(sequelize, schemaName, transaction);

            // 5. Mark as fully migrated (version 9 - all baseline migrations included)
            // This ensures NO migrations run during onboarding - schema is complete
            await sequelize.query(
                `INSERT INTO "${schemaName}"."schema_versions" 
                 (version, migration_name, description, applied_by, applied_at)
                 VALUES 
                 (1, 'v1_init', 'Initial baseline - created via SchemaCreationService', 'schemaCreationService', NOW()),
                 (3, 'v3_schema_alignment', 'Schema alignment - created via SchemaCreationService', 'schemaCreationService', NOW()),
                 (4, 'v4_drop_product_stock_column', 'Drop product stock column - created via SchemaCreationService', 'schemaCreationService', NOW()),
                 (5, 'v5_global_alignment', 'Global alignment - created via SchemaCreationService', 'schemaCreationService', NOW()),
                 (6, 'v6_comprehensive_indexing', 'Comprehensive indexing - created via SchemaCreationService', 'schemaCreationService', NOW()),
                 (7, 'v7_baseline_complete', 'Complete baseline schema - SchemaCreationService', 'schemaCreationService', NOW()),
                 (8, 'v8_add_missing_fields', 'Added barcode, cost, tax_rate, type, notes - SchemaCreationService', 'schemaCreationService', NOW()),
                 (9, 'v9_settings_verify', 'Settings table verification - SchemaCreationService', 'schemaCreationService', NOW())
                 ON CONFLICT (version) DO NOTHING`,
                { transaction }
            );

            await transaction.commit();

            const duration = Date.now() - startTime;
            console.log(`[SchemaCreationService] ✅ COMPLETE schema created in ${duration}ms: ${schemaName}`);

            return {
                success: true,
                schemaName,
                duration,
                tablesCreated: this.requiredTables.length
            };

        } catch (error) {
            await transaction.rollback();
            console.error(`[SchemaCreationService] ❌ Schema creation failed:`, error.message);
            throw error;
        }
    }

    /**
     * Create schema_versions table
     */
    async _createSchemaVersionsTable(sequelize, schemaName, transaction) {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "${schemaName}"."schema_versions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID,
                "version" INTEGER UNIQUE NOT NULL,
                "migration_name" VARCHAR(255),
                "description" TEXT,
                "checksum" VARCHAR(64),
                "applied_by" VARCHAR(100),
                "applied_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `, { transaction });
    }

    /**
     * Create ALL tables with COMPLETE structure
     * Each table includes ALL required columns from the start
     */
    async _createAllTables(sequelize, schemaName, transaction) {
        const s = schemaName;
        const statements = [
            // outlets - MUST be first (other tables reference it)
            `CREATE TABLE IF NOT EXISTS "${s}"."outlets" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "address" TEXT,
                "manager_user_id" UUID,
                "is_head_office" BOOLEAN DEFAULT false,
                "email" VARCHAR(255),
                "status" VARCHAR(255) DEFAULT 'active',
                "phone" VARCHAR(255),
                "gst_number" VARCHAR(255),
                "parent_outlet_id" UUID,
                "is_active" BOOLEAN DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // accounts
            `CREATE TABLE IF NOT EXISTS "${s}"."accounts" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" VARCHAR(255) NOT NULL,
                "type" VARCHAR(255) DEFAULT 'Cash',
                "balance" DECIMAL(10, 2) DEFAULT 0,
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "status" VARCHAR(255) DEFAULT 'active',
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // table_areas
            `CREATE TABLE IF NOT EXISTS "${s}"."table_areas" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "description" VARCHAR(255),
                "capacity" INTEGER DEFAULT 20,
                "layout" VARCHAR(255) DEFAULT 'square',
                "status" VARCHAR(255) DEFAULT 'active',
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // billing_configs
            `CREATE TABLE IF NOT EXISTS "${s}"."billing_configs" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "business_name" VARCHAR(255) DEFAULT '',
                "business_address" TEXT DEFAULT '',
                "business_phone" VARCHAR(255) DEFAULT '',
                "business_email" VARCHAR(255) DEFAULT '',
                "gst_number" VARCHAR(255) DEFAULT '',
                "tax_rate" DECIMAL(5, 4) DEFAULT 0.05,
                "tax_inclusive" BOOLEAN DEFAULT false,
                "service_charge_rate" DECIMAL(5, 4) DEFAULT 0,
                "footer_text" VARCHAR(255) DEFAULT 'Thank you for your business!',
                "theme_color" VARCHAR(255) DEFAULT '#000000',
                "paper_size" VARCHAR(255) DEFAULT 'Thermal80mm',
                "show_logo" BOOLEAN DEFAULT true,
                "logo_url" VARCHAR(255) DEFAULT '',
                "is_active" BOOLEAN DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // categories - with outlet_id FK
            `CREATE TABLE IF NOT EXISTS "${s}"."categories" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "description" TEXT,
                "color" VARCHAR(255) DEFAULT '#3B82F6',
                "image" VARCHAR(255),
                "is_enabled" BOOLEAN DEFAULT true,
                "sort_order" INTEGER DEFAULT 0,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                CONSTRAINT fk_categories_outlet FOREIGN KEY ("outlet_id") REFERENCES "${s}"."outlets"(id) ON DELETE CASCADE
            )`,

            // customers
            `CREATE TABLE IF NOT EXISTS "${s}"."customers" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "phone" VARCHAR(255) NOT NULL,
                "email" VARCHAR(255),
                "address" TEXT,
                "total_due" DECIMAL(10, 2) DEFAULT 0,
                "total_paid" DECIMAL(10, 2) DEFAULT 0,
                "last_visit_at" TIMESTAMP WITH TIME ZONE,
                "visit_count" INTEGER DEFAULT 0,
                "is_active" BOOLEAN DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // customer_ledger
            `CREATE TABLE IF NOT EXISTS "${s}"."customer_ledger" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "customer_id" UUID NOT NULL,
                "transaction_id" UUID,
                "order_id" UUID,
                "entry_type" VARCHAR(255) NOT NULL,
                "amount" DECIMAL(10, 2) NOT NULL,
                "description" TEXT NOT NULL,
                "balance_before" DECIMAL(10, 2) NOT NULL,
                "balance_after" DECIMAL(10, 2) NOT NULL,
                "entry_date" TIMESTAMP WITH TIME ZONE NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // customer_transactions
            `CREATE TABLE IF NOT EXISTS "${s}"."customer_transactions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "customer_id" UUID NOT NULL,
                "order_id" UUID,
                "transaction_type" VARCHAR(255) NOT NULL,
                "amount" DECIMAL(10, 2) NOT NULL,
                "payment_method" VARCHAR(255),
                "description" TEXT,
                "transaction_date" TIMESTAMP WITH TIME ZONE NOT NULL,
                "created_by" UUID,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // expenses
            `CREATE TABLE IF NOT EXISTS "${s}"."expenses" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "expense_type_id" UUID NOT NULL,
                "amount" DECIMAL(10, 2) NOT NULL,
                "description" VARCHAR(255),
                "date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "payment_method" VARCHAR(255) DEFAULT 'Cash',
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // expense_types
            `CREATE TABLE IF NOT EXISTS "${s}"."expense_types" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "description" VARCHAR(255),
                "is_enabled" BOOLEAN DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // feature_flags
            `CREATE TABLE IF NOT EXISTS "${s}"."feature_flags" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "description" VARCHAR(255),
                "is_enabled" BOOLEAN DEFAULT false,
                "rollout_percentage" INTEGER DEFAULT 0,
                "target_users" JSONB DEFAULT '[]',
                "target_plan" VARCHAR(255),
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // incomes
            `CREATE TABLE IF NOT EXISTS "${s}"."incomes" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "amount" DECIMAL(10, 2) NOT NULL,
                "source" VARCHAR(255) NOT NULL,
                "description" VARCHAR(255),
                "date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "payment_method" VARCHAR(255) DEFAULT 'Cash',
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // inventory
            `CREATE TABLE IF NOT EXISTS "${s}"."inventory" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "product_id" UUID,
                "item_name" VARCHAR(255),
                "quantity" DECIMAL(10, 3) DEFAULT 0,
                "unit_cost" DECIMAL(10, 2) DEFAULT 0,
                "location" VARCHAR(255),
                "reorder_level" DECIMAL(10, 3) DEFAULT 10,
                "last_restocked_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // inventory_categories
            `CREATE TABLE IF NOT EXISTS "${s}"."inventory_categories" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "is_active" BOOLEAN DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // inventory_items - with SKU
            `CREATE TABLE IF NOT EXISTS "${s}"."inventory_items" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" VARCHAR(255) NOT NULL,
                "inventory_category_id" UUID NOT NULL,
                "unit" VARCHAR(255) DEFAULT 'piece',
                "sku" VARCHAR(255),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "current_stock" DECIMAL(10, 3) DEFAULT 0,
                "minimum_stock" DECIMAL(10, 3) DEFAULT 5,
                "cost_per_unit" DECIMAL(10, 2) DEFAULT 0,
                "supplier_id" UUID,
                "supplier_name" VARCHAR(255),
                "last_restocked_at" TIMESTAMP WITH TIME ZONE,
                "is_active" BOOLEAN DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // inventory_sales
            `CREATE TABLE IF NOT EXISTS "${s}"."inventory_sales" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID,
                "inventory_item_id" UUID NOT NULL,
                "product_id" UUID,
                "customer_id" UUID,
                "quantity" DECIMAL(10, 2) NOT NULL,
                "sale_price" DECIMAL(10, 2) NOT NULL,
                "total_amount" DECIMAL(10, 2) NOT NULL,
                "notes" TEXT,
                "recorded_by" UUID,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // inventory_transactions
            `CREATE TABLE IF NOT EXISTS "${s}"."inventory_transactions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "inventory_id" UUID NOT NULL,
                "inventory_item_id" UUID,
                "product_id" UUID,
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "type" VARCHAR(255),
                "transaction_type" VARCHAR(255),
                "quantity" DECIMAL(10, 3) NOT NULL,
                "unit_cost" DECIMAL(10, 2),
                "cost_per_unit" DECIMAL(10, 2),
                "total_cost" DECIMAL(10, 2),
                "previous_quantity" DECIMAL(10, 3),
                "previous_stock" DECIMAL(10, 3),
                "new_quantity" DECIMAL(10, 3),
                "new_stock" DECIMAL(10, 3),
                "performed_by" UUID,
                "created_by" UUID,
                "reference" VARCHAR(255),
                "reason" TEXT,
                "notes" TEXT,
                "invoice_number" VARCHAR(255),
                "supplier_id" UUID,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // membership_plans
            `CREATE TABLE IF NOT EXISTS "${s}"."membership_plans" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "price" DECIMAL(10, 2) NOT NULL,
                "duration_days" INTEGER NOT NULL,
                "outlets_limit" INTEGER DEFAULT 1,
                "staff_limit" INTEGER DEFAULT 5,
                "max_products" INTEGER DEFAULT 100,
                "max_invoices" INTEGER DEFAULT 1000,
                "api_rate_limit" INTEGER DEFAULT 60,
                "features" JSONB DEFAULT '[]',
                "is_active" BOOLEAN DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // operation_timings
            `CREATE TABLE IF NOT EXISTS "${s}"."operation_timings" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "day" VARCHAR(255) NOT NULL,
                "open_time" VARCHAR(255),
                "close_time" VARCHAR(255),
                "is_open" BOOLEAN DEFAULT true,
                "special_hours" JSONB,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // orders - with outlet_id FK
            `CREATE TABLE IF NOT EXISTS "${s}"."orders" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "order_number" VARCHAR(50) NOT NULL,
                "customer_details" JSONB,
                "table_id" UUID,
                "customer_id" UUID,
                "staff_id" UUID,
                "status" VARCHAR(50) DEFAULT 'CREATED' NOT NULL,
                "billing_subtotal" DECIMAL(15, 2) DEFAULT 0 NOT NULL,
                "billing_tax" DECIMAL(15, 2) DEFAULT 0 NOT NULL,
                "billing_discount" DECIMAL(15, 2) DEFAULT 0 NOT NULL,
                "billing_total" DECIMAL(15, 2) DEFAULT 0 NOT NULL,
                "payment_method" VARCHAR(50),
                "payment_status" VARCHAR(50),
                "type" VARCHAR(50) DEFAULT 'DINE_IN' NOT NULL,
                "notes" TEXT,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CONSTRAINT fk_orders_outlet FOREIGN KEY ("outlet_id") REFERENCES "${s}"."outlets"(id) ON DELETE CASCADE
            )`,

            // order_items - with order_id FK
            `CREATE TABLE IF NOT EXISTS "${s}"."order_items" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "order_id" UUID NOT NULL,
                "product_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "quantity" INTEGER DEFAULT 1 NOT NULL,
                "price" DECIMAL(15, 2) DEFAULT 0 NOT NULL,
                "subtotal" DECIMAL(15, 2) DEFAULT 0 NOT NULL,
                "notes" TEXT,
                "status" VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                CONSTRAINT fk_order_items_order FOREIGN KEY ("order_id") REFERENCES "${s}"."orders"(id) ON DELETE CASCADE
            )`,

            // partner_memberships
            `CREATE TABLE IF NOT EXISTS "${s}"."partner_memberships" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "plan_id" UUID NOT NULL,
                "start_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "end_date" TIMESTAMP WITH TIME ZONE,
                "status" VARCHAR(255) DEFAULT 'active',
                "payment_id" VARCHAR(255),
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "partner_type_id" UUID
            )`,

            // partner_types
            `CREATE TABLE IF NOT EXISTS "${s}"."partner_types" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "commission_percentage" DOUBLE PRECISION DEFAULT 0,
                "description" VARCHAR(255),
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // partner_wallets
            `CREATE TABLE IF NOT EXISTS "${s}"."partner_wallets" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "balance" DECIMAL(10, 2) DEFAULT 0,
                "transactions" JSONB DEFAULT '[]',
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // payments
            `CREATE TABLE IF NOT EXISTS "${s}"."payments" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID,
                "payment_id" VARCHAR(255),
                "order_id" VARCHAR(255),
                "internal_order_id" UUID,
                "amount" DECIMAL(10, 2),
                "currency" VARCHAR(255),
                "status" VARCHAR(255),
                "method" VARCHAR(255),
                "email" VARCHAR(255),
                "contact" VARCHAR(255),
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // products - with SKU, outlet_id, category_id
            `CREATE TABLE IF NOT EXISTS "${s}"."products" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "category_id" UUID NOT NULL,
                "product_type_id" UUID,
                "name" VARCHAR(255) NOT NULL,
                "price" DECIMAL(15, 2) DEFAULT 0 NOT NULL,
                "is_active" BOOLEAN DEFAULT true,
                "description" TEXT,
                "image" VARCHAR(255),
                "sku" VARCHAR(255),
                "barcode" VARCHAR(255),
                "cost" DECIMAL(15, 2) DEFAULT 0 NOT NULL,
                "tax_rate" DECIMAL(5, 2) DEFAULT 0 NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                CONSTRAINT fk_products_category FOREIGN KEY ("category_id") REFERENCES "${s}"."categories"(id) ON DELETE CASCADE,
                CONSTRAINT fk_products_outlet FOREIGN KEY ("outlet_id") REFERENCES "${s}"."outlets"(id) ON DELETE CASCADE
            )`,

            // product_types
            `CREATE TABLE IF NOT EXISTS "${s}"."product_types" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "description" VARCHAR(255),
                "icon" VARCHAR(255) DEFAULT '🥬',
                "color" VARCHAR(255) DEFAULT '#10B981',
                "category_id" UUID,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // purchases
            `CREATE TABLE IF NOT EXISTS "${s}"."purchases" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "supplier_id" UUID,
                "supplier_name" VARCHAR(255),
                "total_amount" DECIMAL(10, 2) NOT NULL,
                "items" JSONB DEFAULT '[]',
                "date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "status" VARCHAR(255) DEFAULT 'Completed',
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // purchase_items
            `CREATE TABLE IF NOT EXISTS "${s}"."purchase_items" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "purchase_id" UUID NOT NULL,
                "product_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "cost_price" DECIMAL(10, 2) NOT NULL,
                "quantity" DECIMAL(10, 2) NOT NULL,
                "unit" VARCHAR(255),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // recipes
            `CREATE TABLE IF NOT EXISTS "${s}"."recipes" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "product_id" UUID NOT NULL,
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "instructions" TEXT,
                "prep_time" INTEGER DEFAULT 0,
                "version" INTEGER DEFAULT 1,
                "is_active" BOOLEAN DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // recipe_items
            `CREATE TABLE IF NOT EXISTS "${s}"."recipe_items" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "recipe_id" UUID NOT NULL,
                "inventory_item_id" UUID NOT NULL,
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "quantity_required" DECIMAL(10, 3) NOT NULL,
                "unit" VARCHAR(255) NOT NULL,
                "is_optional" BOOLEAN DEFAULT false,
                "notes" TEXT,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // roll_trackings
            `CREATE TABLE IF NOT EXISTS "${s}"."roll_trackings" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "roll_name" VARCHAR(255) DEFAULT 'Thermal Roll',
                "status" VARCHAR(255) DEFAULT 'active',
                "length" DOUBLE PRECISION DEFAULT 50,
                "printed_length" DOUBLE PRECISION DEFAULT 0,
                "started_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "ended_at" TIMESTAMP WITH TIME ZONE,
                "replaced_by" UUID,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // settings
            `CREATE TABLE IF NOT EXISTS "${s}"."settings" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "app_name" VARCHAR(255) DEFAULT 'BrewwLabs POS',
                "logo_url" VARCHAR(255),
                "support_email" VARCHAR(255),
                "support_phone" VARCHAR(255),
                "terms_url" VARCHAR(255),
                "privacy_url" VARCHAR(255),
                "maintenance_mode" BOOLEAN DEFAULT false,
                "currency" VARCHAR(255) DEFAULT 'INR',
                "timezone" VARCHAR(255) DEFAULT 'Asia/Kolkata',
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // stock_transactions
            `CREATE TABLE IF NOT EXISTS "${s}"."stock_transactions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "inventory_item_id" UUID NOT NULL,
                "type" VARCHAR(255) NOT NULL,
                "quantity" DECIMAL(10, 2) NOT NULL,
                "unit_cost" DECIMAL(10, 2),
                "total_cost" DECIMAL(10, 2),
                "previous_stock" DECIMAL(10, 2),
                "new_stock" DECIMAL(10, 2),
                "supplier_id" UUID,
                "recipe_id" UUID,
                "invoice_number" VARCHAR(255),
                "reason" TEXT,
                "adjustment_type" VARCHAR(255),
                "transaction_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "recorded_by" UUID,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // suppliers
            `CREATE TABLE IF NOT EXISTS "${s}"."suppliers" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "contact_person" VARCHAR(255),
                "email" VARCHAR(255),
                "phone" VARCHAR(255),
                "address" TEXT,
                "gst_number" VARCHAR(255),
                "payment_terms" VARCHAR(255),
                "notes" TEXT,
                "is_active" BOOLEAN DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )`,

            // tables
            `CREATE TABLE IF NOT EXISTS "${s}"."tables" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "table_no" VARCHAR(255),
                "capacity" INTEGER DEFAULT 4,
                "area_id" UUID,
                "status" VARCHAR(255) DEFAULT 'Available',
                "current_order_id" UUID,
                "shape" VARCHAR(255) DEFAULT 'square',
                "current_occupancy" INTEGER DEFAULT 0,
                "qr_code" VARCHAR(255),
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // audit_logs
            `CREATE TABLE IF NOT EXISTS "${s}"."audit_logs" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" UUID NOT NULL,
                "user_name" VARCHAR(255),
                "user_role" VARCHAR(255),
                "action" VARCHAR(255) NOT NULL,
                "module" VARCHAR(255) NOT NULL,
                "target_id" UUID,
                "business_id" UUID NOT NULL,
                "outlet_id" UUID,
                "details" JSONB,
                "ip_address" VARCHAR(255),
                "user_agent" VARCHAR(255),
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // timings
            `CREATE TABLE IF NOT EXISTS "${s}"."timings" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "day" VARCHAR(255) NOT NULL,
                "open_time" VARCHAR(255) NOT NULL,
                "close_time" VARCHAR(255) NOT NULL,
                "is_closed" BOOLEAN DEFAULT false,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // account_transactions
            `CREATE TABLE IF NOT EXISTS "${s}"."account_transactions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "type" VARCHAR(255) NOT NULL,
                "category" VARCHAR(255) NOT NULL,
                "amount" DECIMAL(10, 2) NOT NULL,
                "description" VARCHAR(255),
                "account_id" UUID NOT NULL,
                "date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "performed_by" UUID,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // wastages
            `CREATE TABLE IF NOT EXISTS "${s}"."wastages" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "inventory_id" UUID NOT NULL,
                "inventory_item_id" UUID,
                "quantity" DECIMAL(10, 2) NOT NULL,
                "reason" VARCHAR(255) NOT NULL,
                "wastage_date" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "notes" TEXT,
                "recorded_by" UUID,
                "cost_value" DECIMAL(10, 2),
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            // web_contents
            `CREATE TABLE IF NOT EXISTS "${s}"."web_contents" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID,
                "page" VARCHAR(255) NOT NULL,
                "title" VARCHAR(255),
                "content" TEXT,
                "meta_description" VARCHAR(255),
                "images" JSONB DEFAULT '[]',
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`
        ];

        console.log(`[SchemaCreationService] Creating ${statements.length} tables...`);

        for (const sql of statements) {
            await sequelize.query(sql, { transaction });
        }

        console.log(`[SchemaCreationService] ✅ All ${statements.length} tables created`);
    }

    /**
     * Create indexes for performance
     */
    async _createIndexes(sequelize, schemaName, transaction) {
        const s = schemaName;
        const indexes = [
            // Business ID indexes (most common query pattern)
            `CREATE INDEX IF NOT EXISTS idx_outlets_business_id ON "${s}"."outlets"("business_id")`,
            `CREATE INDEX IF NOT EXISTS idx_categories_business_id ON "${s}"."categories"("business_id")`,
            `CREATE INDEX IF NOT EXISTS idx_products_business_id ON "${s}"."products"("business_id")`,
            `CREATE INDEX IF NOT EXISTS idx_orders_business_id ON "${s}"."orders"("business_id")`,
            `CREATE INDEX IF NOT EXISTS idx_inventory_items_business_id ON "${s}"."inventory_items"("business_id")`,
            `CREATE INDEX IF NOT EXISTS idx_customers_business_id ON "${s}"."customers"("business_id")`,
            
            // Outlet ID indexes
            `CREATE INDEX IF NOT EXISTS idx_categories_outlet_id ON "${s}"."categories"("outlet_id")`,
            `CREATE INDEX IF NOT EXISTS idx_products_outlet_id ON "${s}"."products"("outlet_id")`,
            `CREATE INDEX IF NOT EXISTS idx_orders_outlet_id ON "${s}"."orders"("outlet_id")`,
            `CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON "${s}"."order_items"("order_id")`,
            `CREATE INDEX IF NOT EXISTS idx_inventory_items_outlet_id ON "${s}"."inventory_items"("outlet_id")`,
            
            // SKU index for products
            `CREATE INDEX IF NOT EXISTS idx_products_sku ON "${s}"."products"("sku")`,
            
            // Status indexes
            `CREATE INDEX IF NOT EXISTS idx_orders_status ON "${s}"."orders"("status")`,
            `CREATE INDEX IF NOT EXISTS idx_products_is_active ON "${s}"."products"("is_active")`,
            
            // Created at indexes (for sorting)
            `CREATE INDEX IF NOT EXISTS idx_orders_created_at ON "${s}"."orders"("created_at" DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_products_created_at ON "${s}"."products"("created_at" DESC)`,
            
            // Foreign key indexes
            `CREATE INDEX IF NOT EXISTS idx_products_category_id ON "${s}"."products"("category_id")`,
            `CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON "${s}"."order_items"("product_id")`,
            `CREATE INDEX IF NOT EXISTS idx_inventory_transactions_inventory_item_id ON "${s}"."inventory_transactions"("inventory_item_id")`,
            
            // Unique indexes
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_business_id ON "${s}"."settings"("business_id")`,
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_configs_business_id ON "${s}"."billing_configs"("business_id")`
        ];

        for (const sql of indexes) {
            try {
                await sequelize.query(sql, { transaction });
            } catch (error) {
                // Index might already exist, continue
                console.log(`[SchemaCreationService] Index creation note: ${error.message}`);
            }
        }

        console.log(`[SchemaCreationService] ✅ Indexes created`);
    }

    /**
     * Validate that all required tables and columns exist
     */
    async validateSchema(sequelize, schemaName) {
        console.log(`[SchemaCreationService] 🔍 Validating schema: ${schemaName}`);

        // Check all required tables exist
        const tablesResult = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = :schema
            AND table_type = 'BASE TABLE'
        `, {
            replacements: { schema: schemaName },
            type: Sequelize.QueryTypes.SELECT
        });

        const existingTables = tablesResult.map(t => t.table_name);
        const missingTables = this.requiredTables.filter(t => !existingTables.includes(t));

        if (missingTables.length > 0) {
            return {
                valid: false,
                error: `Missing tables: ${missingTables.join(', ')}`
            };
        }

        // Check required columns exist in critical tables
        const requiredColumns = {
            'products': ['id', 'business_id', 'outlet_id', 'sku', 'name', 'created_at', 'updated_at'],
            'inventory_items': ['id', 'business_id', 'outlet_id', 'sku', 'name', 'created_at', 'updated_at'],
            'orders': ['id', 'business_id', 'outlet_id', 'order_number', 'created_at', 'updated_at'],
            'categories': ['id', 'business_id', 'outlet_id', 'name', 'created_at', 'updated_at'],
            'outlets': ['id', 'business_id', 'name', 'created_at', 'updated_at']
        };

        for (const [table, columns] of Object.entries(requiredColumns)) {
            const columnsResult = await sequelize.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = :schema AND table_name = :table
            `, {
                replacements: { schema: schemaName, table },
                type: Sequelize.QueryTypes.SELECT
            });

            const existingColumns = columnsResult.map(c => c.column_name);
            const missingColumns = columns.filter(c => !existingColumns.includes(c));

            if (missingColumns.length > 0) {
                return {
                    valid: false,
                    error: `Missing columns in ${table}: ${missingColumns.join(', ')}`
                };
            }
        }

        console.log(`[SchemaCreationService] ✅ Schema validation passed: ${schemaName}`);
        return { valid: true };
    }
}

module.exports = new SchemaCreationService();
