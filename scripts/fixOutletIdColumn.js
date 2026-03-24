const { Sequelize } = require('sequelize');

/**
 * Quick fix for missing outlet_id column
 */
async function fixOutletIdColumn() {
    let sequelize;
    
    try {
        console.log('🔧 Fixing outlet_id column issue...');
        
        const dbUrl = "postgresql://neondb_owner:npg_ftcY7qM5vGUe@ep-lively-glitter-a1yqd90q-pooler.ap-southeast-1.aws.neon.tech/tenant_brew_cafe?sslmode=require";
        
        sequelize = new Sequelize(dbUrl, {
            dialect: 'postgres',
            dialectOptions: {
                ssl: {
                    require: true,
                    rejectUnauthorized: false
                },
                connectTimeout: 10000,
                statement_timeout: 30000
            },
            logging: console.log
        });
        
        await sequelize.authenticate();
        console.log('✅ Connected to tenant database');
        
        // Check current columns in categories table
        console.log('\n📋 Checking current categories table columns...');
        const [currentColumns] = await sequelize.query(`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_name = 'categories'
            ORDER BY column_name
        `);
        
        console.log('Current columns:');
        currentColumns.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type})`);
        });
        
        // Add outlet_id column if missing
        console.log('\n➕ Adding outlet_id column...');
        try {
            await sequelize.query(`
                ALTER TABLE categories ADD COLUMN IF NOT EXISTS outlet_id UUID
            `);
            console.log('✅ Added outlet_id column to categories');
        } catch (err) {
            console.log(`⚠️ Column add warning: ${err.message}`);
        }
        
        // Verify the fix
        console.log('\n🧪 Verifying outlet_id column...');
        const [verifyColumns] = await sequelize.query(`
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_name = 'categories'
            AND column_name = 'outlet_id'
        `);
        
        if (verifyColumns.length > 0) {
            console.log('✅ outlet_id column now exists in categories table');
        } else {
            console.log('❌ outlet_id column still missing');
        }
        
        // Test adding a category with outlet_id
        console.log('\n📝 Testing category creation with outlet_id...');
        try {
            const [testCategory] = await sequelize.query(`
                INSERT INTO categories (id, name, outlet_id, is_enabled, sort_order, created_at, updated_at)
                VALUES (gen_random_uuid(), 'Test Category with Outlet', NULL, true, 1, NOW(), NOW())
                RETURNING id, name, outlet_id
            `);
            
            console.log(`✅ Created test category: ${testCategory[0].name}`);
            console.log(`   Category ID: ${testCategory[0].id}`);
            console.log(`   Outlet ID: ${testCategory[0].outlet_id || 'NULL'}`);
            
        } catch (err) {
            console.log(`❌ Category creation failed: ${err.message}`);
        }
        
        await sequelize.close();
        
        console.log('\n🎉 outlet_id column fix completed!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (sequelize) {
            await sequelize.close();
        }
        process.exit(1);
    }
}

// Run the fix
if (require.main === module) {
    fixOutletIdColumn();
}

module.exports = { fixOutletIdColumn };
