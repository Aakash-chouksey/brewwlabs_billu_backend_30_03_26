const { Sequelize } = require('sequelize');

/**
 * Neon-specific fix for tenant_connections missing timestamp columns
 */
async function fixNeonTenantConnections() {
    let sequelize;
    
    try {
        console.log('🔧 Fixing tenant_connections timestamp columns for Neon...');
        
        // Get database URL from environment
        const databaseUrl = process.env.DATABASE_URL || process.env.CONTROL_PLANE_DATABASE_URL;
        
        if (!databaseUrl) {
            console.error('❌ ERROR: DATABASE_URL or CONTROL_PLANE_DATABASE_URL not found');
            console.error('💡 Set your Neon database URL:');
            console.error('   DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/db?sslmode=require');
            process.exit(1);
        }
        
        console.log('🔗 Connecting to Neon database...');
        console.log(`   URL: ${databaseUrl.split('@')[1]}...`); // Show only host part for security
        
        // Configure for Neon
        sequelize = new Sequelize(databaseUrl, {
            dialect: 'postgres',
            dialectOptions: {
                ssl: {
                    require: true,
                    rejectUnauthorized: false
                },
                connectTimeout: 10000,
                statement_timeout: 30000,
                idle_in_transaction_session_timeout: 30000
            },
            logging: console.log
        });
        
        await sequelize.authenticate();
        console.log('✅ Connected to Neon database');
        
        // Check if tenant_connections table exists
        const [tableCheck] = await sequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'tenant_connections'
            )
        `);
        
        if (!tableCheck[0].exists) {
            console.log('❌ tenant_connections table not found');
            console.log('💡 This appears to be a tenant database, not the control plane');
            console.log('💡 Make sure DATABASE_URL points to your control plane database');
            await sequelize.close();
            process.exit(1);
        }
        
        console.log('📋 Checking existing columns in tenant_connections...');
        
        // Get current columns
        const [currentColumns] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'tenant_connections' 
            ORDER BY column_name
        `);
        
        console.log('📊 Current columns:');
        console.table(currentColumns);
        
        const existingColumnNames = currentColumns.map(col => col.column_name);
        
        // Add created_at if missing
        if (!existingColumnNames.includes('created_at')) {
            console.log('➕ Adding created_at column...');
            await sequelize.query(`
                ALTER TABLE tenant_connections 
                ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW()
            `);
            console.log('✅ Added created_at column');
        } else {
            console.log('✅ created_at column already exists');
        }
        
        // Add updated_at if missing
        if (!existingColumnNames.includes('updated_at')) {
            console.log('➕ Adding updated_at column...');
            await sequelize.query(`
                ALTER TABLE tenant_connections 
                ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW()
            `);
            console.log('✅ Added updated_at column');
        } else {
            console.log('✅ updated_at column already exists');
        }
        
        // Update any existing rows with NULL timestamps
        const [updateResult] = await sequelize.query(`
            UPDATE tenant_connections 
            SET 
                created_at = COALESCE(created_at, NOW()),
                updated_at = COALESCE(updated_at, NOW())
            WHERE created_at IS NULL OR updated_at IS NULL
            RETURNING COUNT(*) as updated_count
        `);
        
        if (updateResult.length > 0 && updateResult[0].updated_count > 0) {
            console.log(`✅ Updated ${updateResult[0].updated_count} rows with timestamps`);
        }
        
        // Final verification
        const [finalColumns] = await sequelize.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'tenant_connections' 
            AND column_name IN ('created_at', 'updated_at')
            ORDER BY column_name
        `);
        
        console.log('\n📊 Final timestamp columns:');
        console.table(finalColumns);
        
        // Test tenant routing query
        console.log('\n🧪 Testing tenant routing query...');
        const [testQuery] = await sequelize.query(`
            SELECT id, brand_id, db_name, created_at, updated_at 
            FROM tenant_connections 
            LIMIT 1
        `);
        
        if (testQuery.length > 0) {
            console.log('✅ Tenant routing query test passed');
            console.log(`   Found ${testQuery.length} tenant connection(s)`);
        }
        
        console.log('\n🎉 SUCCESS: Tenant connections timestamp fix completed!');
        console.log('💡 Your tenant routing should now work correctly');
        console.log('💡 Restart your server: npm run dev');
        
        await sequelize.close();
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        
        if (error.message.includes('password') || error.message.includes('authentication')) {
            console.error('💡 Check your Neon database credentials');
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            console.error('💡 Check your Neon database host and network connection');
        }
        
        if (sequelize) {
            await sequelize.close();
        }
        process.exit(1);
    }
}

// Run the fix
if (require.main === module) {
    fixNeonTenantConnections();
}

module.exports = { fixNeonTenantConnections };
