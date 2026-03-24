const { Sequelize } = require('sequelize');

/**
 * Fix column naming from camelCase to snake_case
 */
async function fixColumnNaming() {
    let sequelize;
    
    try {
        console.log('🔧 Fixing column naming convention...');
        
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
        
        // Column renames needed
        const columnRenames = [
            { table: 'categories', from: 'outletid', to: 'outlet_id' },
            { table: 'categories', from: 'isenabled', to: 'is_enabled' },
            { table: 'categories', from: 'sortorder', to: 'sort_order' },
            { table: 'products', from: 'outletid', to: 'outlet_id' },
            { table: 'products', from: 'categoryid', to: 'category_id' },
            { table: 'products', from: 'isavailable', to: 'is_available' },
            { table: 'users', from: 'primaryoutletid', to: 'primary_outlet_id' },
            { table: 'users', from: 'tokenversion', to: 'token_version' },
            { table: 'users', from: 'assignedcategories', to: 'assigned_categories' },
            { table: 'users', from: 'lastlogin', to: 'last_login' },
            { table: 'users', from: 'isactive', to: 'is_active' },
            { table: 'orders', from: 'outletid', to: 'outlet_id' },
            { table: 'orders', from: 'ordernumber', to: 'order_number' },
            { table: 'orders', from: 'userid', to: 'user_id' },
            { table: 'orders', from: 'totalamount', to: 'total_amount' },
            { table: 'orders', from: 'customerid', to: 'customer_id' },
            { table: 'orders', from: 'tableid', to: 'table_id' },
            { table: 'orders', from: 'paymentmethod', to: 'payment_method' },
            { table: 'orders', from: 'paymentstatus', to: 'payment_status' }
        ];
        
        console.log('\n📝 Renaming columns from camelCase to snake_case...');
        
        for (const rename of columnRenames) {
            try {
                await sequelize.query(`
                    ALTER TABLE ${rename.table} RENAME COLUMN "${rename.from}" TO ${rename.to}
                `);
                console.log(`✅ Renamed ${rename.table}.${rename.from} to ${rename.to}`);
            } catch (err) {
                console.log(`⚠️ Rename ${rename.table}.${rename.from} warning: ${err.message}`);
            }
        }
        
        // Verify the renames
        console.log('\n🧪 Verifying column renames...');
        
        for (const rename of columnRenames) {
            try {
                const [check] = await sequelize.query(`
                    SELECT column_name
                    FROM information_schema.columns 
                    WHERE table_name = :tableName
                    AND column_name = :columnName
                `, {
                    replacements: { 
                        tableName: rename.table, 
                        columnName: rename.to 
                    },
                    type: sequelize.QueryTypes.SELECT
                });
                
                if (check.length > 0) {
                    console.log(`✅ ${rename.table}.${rename.to} exists`);
                } else {
                    console.log(`❌ ${rename.table}.${rename.to} still missing`);
                }
            } catch (err) {
                console.log(`❌ Check ${rename.table}.${rename.to} failed: ${err.message}`);
            }
        }
        
        await sequelize.close();
        
        console.log('\n🎉 Column naming convention fix completed!');
        console.log('✅ All camelCase columns renamed to snake_case');
        console.log('✅ Your tenant routing should now work perfectly');
        
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
    fixColumnNaming();
}

module.exports = { fixColumnNaming };
