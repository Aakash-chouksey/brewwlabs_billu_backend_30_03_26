/**
 * MIGRATION v4: REMOVE REDUNDANT PRODUCT STOCK
 * 
 * 1. Syncs 'current_stock' from products table to inventory table (Migration-safe).
 * 2. Drops 'current_stock' from products table to eliminate data duplication.
 */
module.exports = {
    version: 4,
    description: 'Sync stock to inventory and drop redundant current_stock column',
    async up(sequelize, schemaName, tenantModels, transaction) {
        const startTime = Date.now();
        console.log(`[Migration] v4_drop_product_stock_column: processing ${schemaName}`);

        const options = transaction ? { transaction } : {};

        // SKIP: This migration only applies to tenant schemas, not public
        if (schemaName === 'public') {
            console.log(`[Migration] v4: Skipping public schema (tenant-only migration)`);
            return true;
        }

        try {
            // 1. Ensure inventory table exists (Safety check)
            const [iTableResult] = await sequelize.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = :schema AND table_name = 'inventory'
            `, { ...options, replacements: { schema: schemaName } });
            const iTable = iTableResult || [];

            if (iTable && iTable.length === 0) {
                await sequelize.query(`
                    CREATE TABLE IF NOT EXISTS "${schemaName}"."inventory" (
                        "id" UUID PRIMARY KEY,
                        "business_id" UUID NOT NULL,
                        "outlet_id" UUID NOT NULL,
                        "product_id" UUID NOT NULL,
                        "quantity" DECIMAL(15,2) DEFAULT 0,
                        "unit_cost" DECIMAL(15,2) DEFAULT 0,
                        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                `, options);
            }

            // 2. Sync data: Insert into inventory for products that don't have an entry
            const [columnExistsResult] = await sequelize.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = :schema AND table_name = 'products' AND column_name = 'current_stock'
                )
            `, { ...options, replacements: { schema: schemaName } });
            const columnExists = columnExistsResult || [];

            if (columnExists[0].exists) {
                await sequelize.query(`
                    INSERT INTO "${schemaName}"."inventory" (business_id, outlet_id, product_id, quantity, created_at, updated_at)
                    SELECT business_id, outlet_id, id, COALESCE(current_stock, 0), NOW(), NOW()
                    FROM "${schemaName}"."products" p
                    WHERE NOT EXISTS (
                        SELECT 1 FROM "${schemaName}"."inventory" i 
                        WHERE i.product_id = p.id
                    )
                    AND current_stock > 0
                `, options);
            }

            // 3. Drop the redundant column
            await sequelize.query(`
                ALTER TABLE "${schemaName}"."products" 
                DROP COLUMN IF EXISTS "current_stock"
            `, options);

            const duration = Date.now() - startTime;
            console.log(`[Migration] ✅ v4 complete: ${duration}ms`);
            return true;
        } catch (error) {
            console.error(`[Migration] v4 failed for ${schemaName}:`, error.message);
            throw error;
        }
    }
};
