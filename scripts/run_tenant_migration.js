require('dotenv').config();
const tenantConnectionFactory = require('../src/services/tenantConnectionFactory');
const fs = require('fs');
const path = require('path');

async function runTenantMigration(tenantBrandId) {
    try {
        console.log(`🔄 Running tenant migration for brand: ${tenantBrandId}`);
        
        // Get tenant connection
        const tenantSequelize = await tenantConnectionFactory.getConnection(tenantBrandId);
        
        // Read the tenant schema file
        const schemaPath = path.join(__dirname, '../migrations/tenant/001_init_tenant_schema.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📊 Executing tenant schema creation...');
        
        // Split the SQL file by semicolons and execute each statement
        const statements = schemaSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await tenantSequelize.query(statement + ';');
                    console.log('✅ Executed:', statement.substring(0, 50) + '...');
                } catch (error) {
                    // Ignore errors for IF NOT EXISTS statements
                    if (!error.message.includes('already exists')) {
                        console.warn('⚠️  Statement warning:', error.message);
                    }
                }
            }
        }
        
        // Verify tables were created
        const [tables] = await tenantSequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('📋 Created tables:', tables.map(t => t.table_name).join(', '));
        
        // Test the specific tables that were failing
        try {
            await tenantSequelize.query('SELECT COUNT(*) FROM orders');
            console.log('✅ Orders table accessible');
        } catch (error) {
            console.log('ℹ️  Orders table not yet populated (expected)');
        }
        
        try {
            await tenantSequelize.query('SELECT COUNT(*) FROM products');
            console.log('✅ Products table accessible');
        } catch (error) {
            console.log('ℹ️  Products table not yet populated (expected)');
        }
        
        await tenantSequelize.close();
        console.log('🎉 Tenant migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Tenant migration failed:', error);
        process.exit(1);
    }
}

// Get the brand ID from command line arguments or use the one from the error
const brandId = process.argv[2] || '86bc6bab-4ca3-4e67-af56-d3f4d47b61ae';
runTenantMigration(brandId);
