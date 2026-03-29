/**
 * MIGRATION v3: SCHEMA ALIGNMENT (DEPRECATED - NO-OP)
 * 
 * ⚠️ OBSOLETE: v1_init.js now creates complete tables with all required columns.
 * This migration is kept for backward compatibility but does nothing for new tenants.
 * 
 * For existing tenants created before v1_init, the columns would have been added
 * by subsequent migrations. Fresh tenants get complete schema from v1_init.
 */
module.exports = {
    version: 3,
    description: 'Schema alignment - DEPRECATED (v1_init provides complete schema)',
    async up(sequelize, schemaName, tenantModels, transaction) {
        console.log(`[Migration] v3_schema_alignment: SKIPPED for ${schemaName} (v1_init provides complete schema)`);
        return true;
    }
};
