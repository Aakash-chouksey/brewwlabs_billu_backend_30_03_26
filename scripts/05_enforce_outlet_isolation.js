const { sequelize } = require('../config/unified_database');
const { controlPlaneSequelize } = require('../config/control_plane_db');

async function migrateNullOutlets() {
    console.log('🔄 STARTING OUTLET ISOLATION MIGRATION...');
    
    try {
        await sequelize.authenticate();
        await controlPlaneSequelize.authenticate();
        
        // 1. Get all active tenants
        const [businesses] = await controlPlaneSequelize.query(`
            SELECT id, name FROM businesses WHERE is_active = true
        `);
        
        console.log(`📋 Found ${businesses.length} active businesses. Assinging orphans to primary outlets...`);

        for (const business of businesses) {
            const businessId = business.id;
            const schema = `tenant_${businessId}`;
            console.log(`\n🏢 Processing business: ${business.name} (${businessId})`);

            // 2. Find primary outlet
            const [outlets] = await sequelize.query(`
                SELECT id FROM "${schema}".outlets WHERE business_id = :businessId ORDER BY created_at ASC LIMIT 1
            `, { replacements: { businessId } });

            if (outlets.length === 0) {
                console.warn(`⚠️ No outlets found for business ${business.name}. Skipping...`);
                continue;
            }

            const primaryOutletId = outlets[0].id;
            console.log(`📍 Primary Outlet ID: ${primaryOutletId}`);

            // 3. Update Categories
            const [catResult] = await sequelize.query(`
                UPDATE "${schema}".categories 
                SET outlet_id = :outletId 
                WHERE outlet_id IS NULL AND business_id = :businessId
            `, { replacements: { outletId: primaryOutletId, businessId } });
            console.log(`   ✅ Categories updated: ${catResult.rowCount || 0}`);

            // 4. Update Products
            const [prodResult] = await sequelize.query(`
                UPDATE "${schema}".products 
                SET outlet_id = :outletId 
                WHERE outlet_id IS NULL AND business_id = :businessId
            `, { replacements: { outletId: primaryOutletId, businessId } });
            console.log(`   ✅ Products updated: ${prodResult.rowCount || 0}`);

            // 5. Update Product Types
            const [typeResult] = await sequelize.query(`
                UPDATE "${schema}".product_types 
                SET outlet_id = :outletId 
                WHERE outlet_id IS NULL AND business_id = :businessId
            `, { replacements: { outletId: primaryOutletId, businessId } });
            console.log(`   ✅ Product Types updated: ${typeResult.rowCount || 0}`);
        }

        console.log('\n🎉 MIGRATION COMPLETE!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateNullOutlets();
