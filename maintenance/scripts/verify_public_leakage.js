const path = require('path');
require('dotenv').config();
const { sequelize } = require('../../config/unified_database');

async function checkPublicSchema() {
    console.log('🔍 Checking public schema for tenant tables...');
    try {
        const [tables] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
        `);
        
        const tableNames = tables.map(t => t.table_name);
        console.log(`📋 Found ${tableNames.length} tables in public schema.`);
        
        const tenantTables = [
            'outlets', 'products', 'orders', 'order_items', 'categories',
            'inventory', 'inventory_items', 'inventory_transactions',
            'customers', 'areas', 'tables', 'recipes', 'recipe_items',
            'suppliers', 'purchases', 'purchase_items', 'expenses', 'incomes', 'payments'
        ];
        
        const leaked = tableNames.filter(t => tenantTables.includes(t));
        
        // Some tables might be in public intentionally if they are control plane models.
        // But the ones listed above (except maybe customers/orders) should NOT be in public.
        // In this architecture, ALL business data is in tenant schemas.
        
        if (leaked.length > 0) {
            console.warn('⚠️ WARNING: The following tenant-like tables exist in the public schema:', leaked.join(', '));
            console.warn('Note: If these were created by previous failed runs, they should be cleaned up manually.');
        } else {
            console.log('✅ No tenant tables leaked into public schema in this run.');
        }
    } catch (error) {
        console.error('💥 Error checking public schema:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

checkPublicSchema();
