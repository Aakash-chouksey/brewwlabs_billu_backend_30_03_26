/**
 * STEP 6: MODEL vs DB SYNC CHECK
 * 
 * Compares Sequelize model definitions with actual database columns.
 */

const colors = require('colors');
const { TENANT_MODELS } = require('../../src/utils/constants');

class ModelSyncChecker {
    static async execute(sequelize, schemaName) {
        console.log(colors.cyan(`  → Checking model vs DB sync for: ${schemaName}...`));
        
        const results = {
            success: true,
            schemaName,
            modelsChecked: 0,
            mismatches: [],
            issues: []
        };

        try {
            // Initialize models
            const { ModelFactory } = require('../../src/architecture/modelFactory');
            await ModelFactory.createModels(sequelize);

            // 1. Check TenantRegistry (Control Plane)
            const TenantRegistry = sequelize.models.TenantRegistry;
            if (TenantRegistry) {
                const attrs = TenantRegistry.rawAttributes;
                if (!attrs.businessId || attrs.businessId.field !== 'business_id') {
                    results.success = false;
                    results.issues.push({
                        severity: 'CRITICAL',
                        message: "TenantRegistry 'businessId' missing or mismapped to 'business_id'",
                        details: { field: attrs.businessId?.field }
                    });
                }
                console.log(colors.gray('    ✓ TenantRegistry businessId mapping verified'));
            }

            // 2. Check each tenant model against its table in the schema
            for (const modelName of TENANT_MODELS) {
                const model = sequelize.models[modelName];
                if (!model) continue;

                results.modelsChecked++;
                const tableName = model.getTableName();
                const tableNameStr = typeof tableName === 'string' ? tableName : tableName?.tableName;

                // Get actual DB columns
                const dbColumns = await sequelize.query(`
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_schema = :schema AND table_name = :table
                `, {
                    replacements: { schema: schemaName, table: tableNameStr },
                    type: sequelize.QueryTypes.SELECT
                });

                const dbColMap = {};
                dbColumns.forEach(c => dbColMap[c.column_name.toLowerCase()] = c);

                // Compare model attributes
                const attributes = model.rawAttributes;
                for (const [attrName, attr] of Object.entries(attributes)) {
                    if (attr.type?.key === 'VIRTUAL') continue;

                    const fieldName = (attr.field || attrName).toLowerCase();
                    if (!dbColMap[fieldName]) {
                        results.success = false;
                        results.issues.push({
                            severity: 'CRITICAL',
                            message: `Model mismatch in '${modelName}': attribute '${attrName}' maps to missing column '${fieldName}' in table '${tableNameStr}'`,
                            details: { model: modelName, attribute: attrName, column: fieldName }
                        });
                    }
                }
            }

            if (results.success) {
                console.log(colors.green(`  ✓ Step 6: Model sync check passed (${results.modelsChecked} models verified)`));
            } else {
                console.log(colors.red(`  ✗ Step 6: Model sync check FAILED with ${results.issues.length} issues`));
            }

        } catch (error) {
            results.success = false;
            results.issues.push({
                severity: 'CRITICAL',
                message: `Model sync check exception: ${error.message}`
            });
        }

        return results;
    }
}

module.exports = ModelSyncChecker;
