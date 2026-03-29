/**
 * MIGRATION: v11_wastage_inventory_item_fix
 * 
 * Objective: Drop the NOT NULL constraint on inventory_id in wastages table.
 * Reason: Support raw material wastage which use inventory_item_id instead.
 */

module.exports = {
    version: 11,
    description: 'Allow null inventory_id in wastages table',
    
    up: async (sequelize, schemaName, models, transaction) => {
        console.log(`[Migration v11] 🔧 Running for schema: ${schemaName}`);
        
        try {
            // Drop the NOT NULL constraint on inventory_id
            await sequelize.query(`
                ALTER TABLE "${schemaName}"."wastages" 
                ALTER COLUMN "inventory_id" DROP NOT NULL
            `, { transaction });
            
            console.log(`[Migration v11] ✅ Successfully updated wastages in ${schemaName}`);
        } catch (error) {
            console.error(`[Migration v11] ❌ Failed to update wastages in ${schemaName}:`, error.message);
            // Some schemas might not have the table yet, we can skip
            if (!error.message.includes('does not exist')) {
                throw error;
            }
        }
    }
};
