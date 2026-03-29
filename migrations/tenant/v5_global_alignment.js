/**
 * MIGRATION v5: GLOBAL SCHEMA ALIGNMENT (DEPRECATED - NO-OP)
 * 
 * ⚠️ OBSOLETE: v1_init.js now creates complete tables with all required columns.
 * This migration is kept for backward compatibility but does nothing for new tenants.
 * 
 * Fresh tenants get complete schema from v1_init. Existing tenants would have
 * received these fixes via earlier migrations.
 */
module.exports = {
    version: 5,
    description: 'Global schema alignment - DEPRECATED (v1_init provides complete schema)',
    async up(sequelize, schemaName, tenantModels, transaction) {
        console.log(`[Migration] v5_global_alignment: SKIPPED for ${schemaName} (v1_init provides complete schema)`);
        return true;
    }
};
