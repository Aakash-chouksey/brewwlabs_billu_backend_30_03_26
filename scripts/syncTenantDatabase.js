#!/usr/bin/env node

/**
 * Sync tenant database schema to create missing tables
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

async function syncTenantDatabase() {
    console.log('🔧 Syncing tenant database schema...');
    
    // Test with one of the problematic tenants
    const brandId = '86bc6bab-4ca3-4e67-af56-d3f4d47b61ae';
    
    // Get tenant connection from control plane
    const controlPlaneSequelize = new Sequelize(process.env.CONTROL_PLANE_DATABASE_URL, {
        dialect: 'postgres',
        dialectOptions: {
            ssl: { require: true, rejectUnauthorized: false }
        },
        logging: false
    });
    
    try {
        await controlPlaneSequelize.authenticate();
        console.log('✅ Connected to control plane database');
        
        // Get tenant connection info
        const [results] = await controlPlaneSequelize.query(`
            SELECT database_url 
            FROM tenant_connections 
            WHERE brand_id = :brandId
        `, {
            replacements: { brandId }
        });
        
        if (results.length === 0) {
            throw new Error(`Tenant not found: ${brandId}`);
        }
        
        const databaseUrl = results[0].database_url;
        console.log('🔗 Using tenant database URL:', databaseUrl);
        
        await controlPlaneSequelize.close();
        
        // Connect to tenant database
        const tenantSequelize = new Sequelize(databaseUrl, {
            dialect: 'postgres',
            define: {
                underscored: true
            },
            dialectOptions: {
                ssl: {
                    require: true,
                    rejectUnauthorized: false
                },
                family: 4,
                connectTimeout: 60000,
                keepAlive: true
            },
            pool: {
                max: 5,
                min: 1,
                acquire: 30000,
                idle: 10000
            },
            logging: console.log // Enable logging to see sync process
        });
        
        await tenantSequelize.authenticate();
        console.log('✅ Connected to tenant database');
        
        // Check existing tables
        const [tables] = await tenantSequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        console.log(`📊 Found ${tables.length} existing tables:`);
        tables.forEach(table => {
            console.log(`   - ${table.table_name}`);
        });
        
        // Import and initialize models
        console.log('📦 Loading models...');
        
        // Load all models in order
        const models = [
            '../models/userModel',
            '../models/businessModel', 
            '../models/outletModel',
            '../models/categoryModel',
            '../models/productTypeModel',
            '../models/productModel',
            '../models/areaModel',
            '../models/tableModel',
            '../models/timingModel',
            '../models/orderModel',
            '../models/orderItemModel',
            '../models/paymentModel',
            '../models/inventoryCategoryModel',
            '../models/inventoryItemModel',
            '../models/inventoryTransactionModel',
            '../models/recipeModel',
            '../models/recipeItemModel',
            '../models/supplierModel',
            '../models/purchaseModel',
            '../models/purchaseItemModel',
            '../models/inventoryAssociations'
        ];
        
        for (const modelPath of models) {
            try {
                const modelFunction = require(modelPath);
                if (typeof modelFunction === 'function') {
                    modelFunction(tenantSequelize);
                    console.log(`✅ Loaded model: ${modelPath}`);
                }
            } catch (error) {
                console.log(`⚠️  Skipped model: ${modelPath} - ${error.message}`);
            }
        }
        
        // ❌ REMOVED: Sync database schema - Data-First Compliance
        // Migrations should be run separately via migration runner
        console.log('⚠️  Migrations must be run separately via: npm run migrate:tenant');
        console.log('✅ Skipping sync - assuming schema already exists via migrations');
        
        // Verify tables were created
        const [finalTables] = await tenantSequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        console.log(`📊 Final table count: ${finalTables.length}`);
        const criticalTables = ['users', 'products', 'orders', 'categories', 'businesses'];
        const missingTables = criticalTables.filter(table => 
            !finalTables.some(t => t.table_name === table)
        );
        
        if (missingTables.length > 0) {
            console.log(`❌ Missing critical tables: ${missingTables.join(', ')}`);
        } else {
            console.log('✅ All critical tables present!');
        }
        
        await tenantSequelize.close();
        
    } catch (error) {
        console.error('❌ Sync failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

if (require.main === module) {
    syncTenantDatabase();
}

module.exports = syncTenantDatabase;
