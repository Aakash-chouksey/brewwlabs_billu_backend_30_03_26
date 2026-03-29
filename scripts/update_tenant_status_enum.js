const { sequelize } = require('../config/unified_database');

async function updateEnum() {
    try {
        console.log('🚀 Updating enum_tenant_registry_status to include CREATING and READY...');
        
        // Check if values already exist to avoid errors
        const enumValues = await sequelize.query(`
            SELECT enumlabel 
            FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE pg_type.typname = 'enum_tenant_registry_status'
        `, { type: sequelize.QueryTypes.SELECT });

        const labels = enumValues.map(v => v.enumlabel);
        
        if (!labels.includes('CREATING')) {
            await sequelize.query("ALTER TYPE enum_tenant_registry_status ADD VALUE IF NOT EXISTS 'CREATING'");
            console.log('✅ Added CREATING to enum');
        } else {
            console.log('ℹ️ CREATING already exists in enum');
        }

        if (!labels.includes('READY')) {
            await sequelize.query("ALTER TYPE enum_tenant_registry_status ADD VALUE IF NOT EXISTS 'READY'");
            console.log('✅ Added READY to enum');
        } else {
            console.log('ℹ️ READY already exists in enum');
        }

        console.log('🎉 Enum update complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to update ENUM:', error.message);
        process.exit(1);
    }
}

updateEnum();
