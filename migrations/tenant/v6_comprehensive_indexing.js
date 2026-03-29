/**
 * MIGRATION v6: COMPREHENSIVE INDEXING
 * 
 * Adds critical secondary indexes to prevent full table scans as data grows.
 * Optimized for Neon/Postgres performance.
 * 
 * FIXED: Now checks if columns exist before creating indexes
 */

module.exports = {
    version: 6,
    description: 'Comprehensive secondary indexing for performance',
    
    async up(sequelize, schemaName, tenantModels, transaction) {
        console.log(`[Migration] 🚀 Adding indexes to ${schemaName}...`);
        
        const options = transaction ? { transaction } : {};
        
        // Helper to check if column exists
        const columnExists = async (table, column) => {
            const [result] = await sequelize.query(`
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = :schema AND table_name = :table AND column_name = :column
            `, {
                replacements: { schema: schemaName, table, column },
                type: sequelize.QueryTypes.SELECT,
                ...options
            });
            return result !== undefined;
        };

        // Helper to check if table exists
        const tableExists = async (table) => {
            const [result] = await sequelize.query(`
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = :schema AND table_name = :table
            `, {
                replacements: { schema: schemaName, table },
                type: sequelize.QueryTypes.SELECT,
                ...options
            });
            return result !== undefined;
        };

        // List of indexes to create (only if column exists)
        const indexConfigs = [
            // ORDERS
            { table: 'orders', column: 'business_id', indexName: 'orders_biz_outlet_idx', extraCols: ['outlet_id'] },
            { table: 'orders', column: 'status', indexName: 'orders_status_idx' },
            { table: 'orders', column: 'created_at', indexName: 'orders_created_at_idx' },
            { table: 'orders', column: 'customer_id', indexName: 'orders_customer_id_idx' },
            
            // ORDER ITEMS
            { table: 'order_items', column: 'business_id', indexName: 'order_items_biz_outlet_idx', extraCols: ['outlet_id'] },
            { table: 'order_items', column: 'order_id', indexName: 'order_items_order_id_idx' },
            { table: 'order_items', column: 'product_id', indexName: 'order_items_product_id_idx' },
            
            // PRODUCTS
            { table: 'products', column: 'business_id', indexName: 'products_biz_idx' },
            { table: 'products', column: 'category_id', indexName: 'products_category_id_idx' },
            { table: 'products', column: 'sku', indexName: 'products_sku_idx' },
            { table: 'products', column: 'is_active', indexName: 'products_status_idx' },
            
            // INVENTORY
            { table: 'inventory_items', column: 'business_id', indexName: 'inventory_biz_outlet_idx', extraCols: ['outlet_id'] },
            { table: 'inventory', column: 'product_id', indexName: 'inventory_product_id_idx' },
            
            // INVENTORY TRANSACTIONS
            { table: 'inventory_transactions', column: 'business_id', indexName: 'inventory_tx_biz_outlet_idx', extraCols: ['outlet_id'] },
            { table: 'inventory_transactions', column: 'created_at', indexName: 'inventory_tx_created_at_idx' },
            
            // CUSTOMERS
            { table: 'customers', column: 'business_id', indexName: 'customers_biz_idx' },
            { table: 'customers', column: 'phone', indexName: 'customers_phone_idx' },
            
            // TABLES
            { table: 'tables', column: 'business_id', indexName: 'tables_biz_outlet_idx', extraCols: ['outlet_id'] },
            { table: 'tables', column: 'status', indexName: 'tables_status_idx' }
        ];

        // Create indexes only if columns exist
        for (const config of indexConfigs) {
            try {
                const tableExistsCheck = await tableExists(config.table);
                if (!tableExistsCheck) {
                    console.log(`[Migration] v6: Skipping index ${config.indexName} - table ${config.table} does not exist`);
                    continue;
                }

                const colExists = await columnExists(config.table, config.column);
                if (!colExists) {
                    console.log(`[Migration] v6: Skipping index ${config.indexName} - column ${config.table}.${config.column} does not exist`);
                    continue;
                }

                // Build index SQL
                const columns = config.extraCols 
                    ? `("${config.column}", "${config.extraCols.join('", "')}")`
                    : `("${config.column}")`;
                
                const sql = `CREATE INDEX IF NOT EXISTS "${config.indexName}" ON "${schemaName}"."${config.table}" ${columns}`;
                
                await sequelize.query(sql, options);
                console.log(`[Migration] v6: Created index ${config.indexName}`);
            } catch (err) {
                console.warn(`[Migration] v6: Warning - could not create index ${config.indexName}: ${err.message}`);
                // Continue with other indexes
            }
        }

        console.log(`[Migration] ✅ v6 complete for ${schemaName}`);
        return true;
    }
};
