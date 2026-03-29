/**
 * STEP 4: FOREIGN KEY VALIDATION
 * 
 * Validates that all critical foreign keys in the tenant schema exist and reference valid columns.
 */

const colors = require('colors');

class FKValidator {
    static async execute(sequelize, schemaName) {
        console.log(colors.cyan(`  → Validating foreign keys in: ${schemaName}...`));
        
        const results = {
            success: true,
            schemaName,
            issues: []
        };

        try {
            // Check critical FKs: 
            // product.category_id -> categories.id
            // order_item.order_id -> orders.id
            
            const checks = [
                { table: 'products', column: 'category_id', refTable: 'categories', refColumn: 'id' },
                { table: 'products', column: 'outlet_id', refTable: 'outlets', refColumn: 'id' },
                { table: 'order_items', column: 'order_id', refTable: 'orders', refColumn: 'id' }
            ];

            for (const check of checks) {
                const [fkCheck] = await sequelize.query(`
                    SELECT
                        kcu.column_name, 
                        ccu.table_name AS foreign_table_name,
                        ccu.column_name AS foreign_column_name 
                    FROM 
                        information_schema.table_constraints AS tc 
                        JOIN information_schema.key_column_usage AS kcu
                          ON tc.constraint_name = kcu.constraint_name
                          AND tc.table_schema = kcu.table_schema
                        JOIN information_schema.constraint_column_usage AS ccu
                          ON ccu.constraint_name = tc.constraint_name
                          AND ccu.table_schema = tc.table_schema
                    WHERE tc.constraint_type = 'FOREIGN KEY' 
                        AND tc.table_schema = :schema
                        AND tc.table_name = :table
                        AND kcu.column_name = :column
                `, {
                    replacements: { schema: schemaName, table: check.table, column: check.column },
                    type: sequelize.QueryTypes.SELECT
                });

                if (!fkCheck || fkCheck.foreign_table_name !== check.refTable) {
                    results.success = false;
                    results.issues.push({
                        severity: 'CRITICAL',
                        message: `FOREIGN KEY MISSING in '${check.table}': '${check.column}' should reference '${check.refTable}.${check.refColumn}'`,
                        details: { table: check.table, column: check.column, refTable: check.refTable }
                    });
                }
            }

            if (results.success) {
                console.log(colors.green('  ✓ Step 4: Foreign key validation PASSED'));
            }

        } catch (error) {
            results.success = false;
            results.issues.push({
                severity: 'CRITICAL',
                message: `FK validation exception: ${error.message}`
            });
        }

        return results;
    }
}

module.exports = FKValidator;
