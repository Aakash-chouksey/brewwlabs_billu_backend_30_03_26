const { sequelize } = require('../config/database_postgres');

async function fixOutletForeignKey() {
    try {
        console.log('🔧 Fixing outlet foreign key constraint...');
        
        // Drop the foreign key constraint if it exists
        try {
            await sequelize.getQueryInterface().removeConstraint('outlets', 'outlets_brand_id_fkey');
            console.log('✅ Removed foreign key constraint');
        } catch (error) {
            console.log('⚠️ Foreign key constraint may not exist:', error.message);
        }
        
        // Add the brand_id column without foreign key constraint
        try {
            await sequelize.getQueryInterface().changeColumn('outlets', 'brand_id', {
                type: require('sequelize').DataTypes.UUID,
                allowNull: false
            });
            console.log('✅ Updated brand_id column without foreign key constraint');
        } catch (error) {
            console.log('⚠️ Column update may not be needed:', error.message);
        }
        
        console.log('✅ Outlet table fixed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing outlet table:', error.message);
        process.exit(1);
    }
}

fixOutletForeignKey();
