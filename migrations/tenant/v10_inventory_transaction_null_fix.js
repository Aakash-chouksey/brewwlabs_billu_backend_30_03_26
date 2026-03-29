/**
 * MIGRATION: v10_inventory_transaction_null_fix
 * 
 * Objective: Drop the NOT NULL constraint on inventory_id in inventory_transactions table.
 * Reason: Support raw material transactions which use inventory_item_id instead.
 */

module.exports = {
    version: 10,
    description: 'Allow null inventory_id in inventory_transactions table',
    
    up: async (sequelize, schemaName, models, transaction) => {
        console.log(`[Migration v10] 🔧 Running for schema: ${schemaName}`);
        
        try {
            // Drop the NOT NULL constraint on inventory_id
            await sequelize.query(`
                ALTER TABLE "${schemaName}"."inventory_transactions" 
                ALTER COLUMN "inventory_id" DROP NOT NULL
            `, { transaction });
            
            console.log(`[Migration v10] ✅ Successfully updated inventory_transactions in ${schemaName}`);
        } catch (error) {
            console.error(`[Migration v10] ❌ Failed to update inventory_transactions in ${schemaName}:`, error.message);
            // Some schemas might not have the table yet if they are brand new, we can skip or throw
            if (!error.message.includes('does not exist')) {
                throw error;
            }
        }
    }
};
