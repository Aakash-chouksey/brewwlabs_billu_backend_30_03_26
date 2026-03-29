/**
 * Migration: Add recovery columns to tenant_registry
 * Adds retry_count, last_error, and activated_at columns for tenant onboarding recovery
 */

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            // Add retry_count column
            await queryInterface.addColumn(
                { tableName: 'tenant_registry', schema: 'public' },
                'retry_count',
                {
                    type: Sequelize.INTEGER,
                    defaultValue: 0,
                    allowNull: false
                },
                { transaction }
            );
            
            // Add last_error column
            await queryInterface.addColumn(
                { tableName: 'tenant_registry', schema: 'public' },
                'last_error',
                {
                    type: Sequelize.TEXT,
                    allowNull: true
                },
                { transaction }
            );
            
            // Add activated_at column
            await queryInterface.addColumn(
                { tableName: 'tenant_registry', schema: 'public' },
                'activated_at',
                {
                    type: Sequelize.DATE,
                    allowNull: true
                },
                { transaction }
            );
            
            await transaction.commit();
            console.log('✅ Migration complete: Added recovery columns to tenant_registry');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Migration failed:', error.message);
            throw error;
        }
    },

    down: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            await queryInterface.removeColumn(
                { tableName: 'tenant_registry', schema: 'public' },
                'retry_count',
                { transaction }
            );
            
            await queryInterface.removeColumn(
                { tableName: 'tenant_registry', schema: 'public' },
                'last_error',
                { transaction }
            );
            
            await queryInterface.removeColumn(
                { tableName: 'tenant_registry', schema: 'public' },
                'activated_at',
                { transaction }
            );
            
            await transaction.commit();
            console.log('✅ Rollback complete: Removed recovery columns from tenant_registry');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Rollback failed:', error.message);
            throw error;
        }
    }
};
