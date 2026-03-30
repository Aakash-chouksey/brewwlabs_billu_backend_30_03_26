/**
 * MIGRATION v1: INITIAL BASELINE - FULL AUTO-GENERATED (V4 - HARDENED)
 * 
 * Generated on: 2026-03-29T00:24:36.527Z
 * Tables: 42
 */

module.exports = {
    version: 1,
    description: 'Initial schema baseline - Full Auto-Generated V4',
    
    async up(sequelize, schemaName, tenantModels, transaction) {
        const s = schemaName;
        const options = { transaction };

        const statements = [
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
                CONSTRAINT fk_outlet FOREIGN KEY (outlet_id) REFERENCES "outlets"(id) ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS "${s}"."product_types" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "description" VARCHAR(255),
                "icon" VARCHAR(255) DEFAULT '🥬',
                "color" VARCHAR(255) DEFAULT '#10B981',
                "category_id" UUID,
                "status" VARCHAR(50) DEFAULT 'active',
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "${s}"."inventory_categories" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "is_active" BOOLEAN DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

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
                CONSTRAINT fk_outlet FOREIGN KEY (outlet_id) REFERENCES "outlets"(id) ON DELETE CASCADE
            )`,

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
                CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES "orders"(id) ON DELETE CASCADE
            )`,

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

            `CREATE TABLE IF NOT EXISTS "${s}"."partner_types" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "commission_percentage" DOUBLE PRECISION DEFAULT 0,
                "description" VARCHAR(255),
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

            `CREATE TABLE IF NOT EXISTS "${s}"."partner_wallets" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "balance" DECIMAL(10, 2) DEFAULT 0,
                "transactions" JSONB DEFAULT '[]',
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )`,

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
                CONSTRAINT fk_category FOREIGN KEY (category_id) REFERENCES "categories"(id) ON DELETE CASCADE,
                CONSTRAINT fk_outlet FOREIGN KEY (outlet_id) REFERENCES "outlets"(id) ON DELETE CASCADE
            )`,

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

        console.log(`[Migration]   -> Creating ${statements.length} tables in ${s}...`);
        for (const sql of statements) {
            await sequelize.query(sql, options);
        }

        return true;
    }
};
