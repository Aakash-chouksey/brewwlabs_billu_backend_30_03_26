/**
 * MIGRATION v9: SETTINGS TABLE VERIFICATION (SIMPLIFIED)
 * 
 * v1_init.js already creates the settings table with correct structure.
 * This migration now only verifies the table exists and adds any missing columns.
 */
module.exports = {
    version: 9,
    description: 'Settings table verification',
    async up(sequelize, schemaName, tenantModels, transaction) {
        const startTime = Date.now();
        console.log(`[Migration] v9_settings_verify: checking ${schemaName}`);

        const options = transaction ? { transaction } : {};

        // SKIP: This migration only applies to tenant schemas, not public
        if (schemaName === 'public') {
            return true;
        }

        try {
            // Check if settings table exists
            const tableExists = async (table) => {
                const res = await sequelize.query(`
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_schema = :schema AND table_name = :table
                `, { ...options, replacements: { schema: schemaName, table }, type: sequelize.QueryTypes.SELECT });
                return res.length > 0;
            };

            if (await tableExists('settings')) {
                // Helper to add column if not exists
                const addColumnIfNotExists = async (column, type, defaultVal = null) => {
                    const colExists = await sequelize.query(`
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_schema = :schema AND table_name = 'settings' AND column_name = :column
                    `, { ...options, replacements: { schema: schemaName, column }, type: sequelize.QueryTypes.SELECT });
                    
                    if (colExists.length === 0) {
                        const defaultClause = defaultVal !== null ? `DEFAULT ${defaultVal}` : '';
                        await sequelize.query(`
                            ALTER TABLE "${schemaName}"."settings" 
                            ADD COLUMN "${column}" ${type} ${defaultClause}
                        `, options);
                        console.log(`[Migration] v9: Added column ${column}`);
                    }
                };
                
                // Only add missing columns - v1_init already creates most
                await addColumnIfNotExists('app_name', 'VARCHAR(255)', "'BrewwLabs POS'");
                await addColumnIfNotExists('logo_url', 'VARCHAR(255)', null);
                await addColumnIfNotExists('support_email', 'VARCHAR(255)', null);
                await addColumnIfNotExists('support_phone', 'VARCHAR(255)', null);
                await addColumnIfNotExists('terms_url', 'VARCHAR(255)', null);
                await addColumnIfNotExists('privacy_url', 'VARCHAR(255)', null);
                await addColumnIfNotExists('maintenance_mode', 'BOOLEAN', 'false');
                await addColumnIfNotExists('currency', 'VARCHAR(10)', "'INR'");
                await addColumnIfNotExists('timezone', 'VARCHAR(50)', "'Asia/Kolkata'");
                
                // Remove outlet_id if it exists (model doesn't have it)
                const outletIdExists = await sequelize.query(`
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_schema = :schema AND table_name = 'settings' AND column_name = 'outlet_id'
                `, { ...options, replacements: { schema: schemaName }, type: sequelize.QueryTypes.SELECT });
                
                if (outletIdExists.length > 0) {
                    await sequelize.query(`
                        ALTER TABLE "${schemaName}"."settings" DROP COLUMN IF EXISTS "outlet_id"
                    `, options);
                    console.log(`[Migration] v9: Removed outlet_id column (not in model)`);
                }
            }

            const duration = Date.now() - startTime;
            console.log(`[Migration] ✅ v9 complete for ${schemaName}: ${duration}ms`);
            return true;
        } catch (error) {
            console.error(`[Migration] v9 FAILED for ${schemaName}:`, error.message);
            throw error;
        }
    }
};
