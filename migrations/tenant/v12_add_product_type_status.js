/**
 * MIGRATION v12: ADD STATUS TO PRODUCT TYPES
 * 
 * Adds status column to product_types table to fix frontend statistics and filtering.
 */
module.exports = {
    version: 12,
    description: 'Add status column to product_types table',
    async up(sequelize, schemaName, tenantModels, transaction) {
        const startTime = Date.now();
        console.log(`[Migration] v12_add_product_type_status: applying to ${schemaName}`);

        const options = transaction ? { transaction } : {};

        // SKIP: This migration only applies to tenant schemas, not public
        if (schemaName === 'public') {
            return true;
        }

        try {
            // Helper to check table exists
            const tableExists = async (table) => {
                const res = await sequelize.query(`
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_schema = :schema AND table_name = :table
                `, { ...options, replacements: { schema: schemaName, table }, type: sequelize.QueryTypes.SELECT });
                return res.length > 0;
            };

            // Update 'product_types' table
            if (await tableExists('product_types')) {
                console.log(`[Migration] v12: Updating product_types table in ${schemaName}`);
                await sequelize.query(`
                    ALTER TABLE "${schemaName}"."product_types" 
                    ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'active'
                `, options);
            }

            const duration = Date.now() - startTime;
            console.log(`[Migration] ✅ v12 complete for ${schemaName}: ${duration}ms`);
            return true;
        } catch (error) {
            console.error(`[Migration] v12 FAILED for ${schemaName}:`, error.message);
            throw error;
        }
    }
};
