/**
 * MIGRATION v8: ADD MISSING PRODUCT AND ORDER FIELDS
 * 
 * Adds columns to products and orders tables that were present in controllers 
 * but missing from models and base schema.
 */
module.exports = {
    version: 8,
    description: 'Add missing product (cost, barcode, tax_rate) and order (type, notes) fields',
    async up(sequelize, schemaName, tenantModels, transaction) {
        const startTime = Date.now();
        console.log(`[Migration] v8_add_missing_fields: applying to ${schemaName}`);

        const options = transaction ? { transaction } : {};

        // SKIP: This migration only applies to tenant schemas, not public
        if (schemaName === 'public') {
            return true;
        }

        try {
            // Helper to check table exists
            const tableExists = async (table) => {
                const res = await sequelize.query(`
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_schema = :schema AND table_name = :table
                `, { ...options, replacements: { schema: schemaName, table }, type: sequelize.QueryTypes.SELECT });
                return res.length > 0;
            };

            // 1. Update 'products' table
            if (await tableExists('products')) {
                console.log(`[Migration] v8: Updating products table in ${schemaName}`);
                await sequelize.query(`
                    ALTER TABLE "${schemaName}"."products" 
                    ADD COLUMN IF NOT EXISTS "barcode" VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS "cost" DECIMAL(15, 2) DEFAULT 0.00,
                    ADD COLUMN IF NOT EXISTS "tax_rate" DECIMAL(5, 2) DEFAULT 0.00
                `, options);
            }

            // 2. Update 'orders' table
            if (await tableExists('orders')) {
                console.log(`[Migration] v8: Updating orders table in ${schemaName}`);
                await sequelize.query(`
                    ALTER TABLE "${schemaName}"."orders" 
                    ADD COLUMN IF NOT EXISTS "type" VARCHAR(50) DEFAULT 'DINE_IN',
                    ADD COLUMN IF NOT EXISTS "notes" TEXT
                `, options);
            }

            const duration = Date.now() - startTime;
            console.log(`[Migration] ✅ v8 complete for ${schemaName}: ${duration}ms`);
            return true;
        } catch (error) {
            console.error(`[Migration] v8 FAILED for ${schemaName}:`, error.message);
            throw error;
        }
    }
};
