/**
 * STEP 3: SCHEMA VALIDATION ENGINE
 * 
 * Validates that all critical tables and columns exist in the tenant schema.
 * Also checks for naming convention consistency (snake_case in DB).
 */

const colors = require('colors');

class SchemaValidator {
    static CRITICAL_TABLES = [
        'products', 'orders', 'inventory_items', 'customers', 'outlets'
    ];

    static CRITICAL_COLUMNS = [
        'business_id', 'outlet_id', 'sku', 'created_at', 'updated_at'
    ];

    static async execute(sequelize, schemaName) {
        console.log(colors.cyan(`  → Validating critical schema: ${schemaName}...`));
        
        const results = {
            success: true,
            schemaName,
            tablesChecked: 0,
            columnsChecked: 0,
            issues: [],
            tableResults: {}
        };

        try {
            // Get all tables and columns from information_schema
            const dbSchema = await sequelize.query(`
                SELECT table_name, column_name 
                FROM information_schema.columns 
                WHERE table_schema = :schema
            `, {
                replacements: { schema: schemaName },
                type: sequelize.QueryTypes.SELECT
            });

            const schemaMap = {};
            dbSchema.forEach(row => {
                if (!schemaMap[row.table_name]) schemaMap[row.table_name] = [];
                schemaMap[row.table_name].push(row.column_name);
            });

            const existingTables = Object.keys(schemaMap);

            // 1. Verify critical tables exist
            for (const table of this.CRITICAL_TABLES) {
                results.tablesChecked++;
                if (!existingTables.includes(table)) {
                    results.success = false;
                    results.issues.push({
                        severity: 'CRITICAL',
                        message: `CRITICAL TABLE MISSING: '${table}'`,
                        details: { table, schema: schemaName }
                    });
                } else {
                    // 2. Verify critical columns exist in these tables (where applicable)
                    const tableColumns = schemaMap[table];
                    
                    for (const column of this.CRITICAL_COLUMNS) {
                        // Skip 'sku' for tables where it doesn't make sense, 
                        // but ensure others exist across almost all critical tables.
                        if (column === 'sku' && (table === 'outlets' || table === 'customers' || table === 'orders')) continue;
                        if (column === 'outlet_id' && table === 'outlets') continue;
                        
                        results.columnsChecked++;
                        if (!tableColumns.includes(column)) {
                            // Check for camelCase version (which is a FAIL as per rules)
                            const camelCaseCol = column.replace(/_([a-z])/g, g => g[1].toUpperCase());
                            const hasCamelCase = tableColumns.includes(camelCaseCol);

                            results.success = false;
                            results.issues.push({
                                severity: 'CRITICAL',
                                message: `CRITICAL COLUMN MISSING in '${table}': '${column}'${hasCamelCase ? ' (Found camelCase version instead)' : ''}`,
                                details: { table, column, foundCamelCase: hasCamelCase }
                            });
                        }
                    }
                }
            }

            // 3. Overall CASE check for all columns in critical tables
            for (const table of this.CRITICAL_TABLES) {
                if (!schemaMap[table]) continue;
                
                const camelCaseCols = schemaMap[table].filter(c => /[A-Z]/.test(c));
                if (camelCaseCols.length > 0) {
                    results.success = false;
                    results.issues.push({
                        severity: 'CRITICAL',
                        message: `Naming convention violation in '${table}': found camelCase columns: ${camelCaseCols.join(', ')} (Expected snake_case)`,
                        details: { table, camelCaseCols }
                    });
                }
            }

            if (results.success) {
                console.log(colors.green(`  ✓ Step 3: Schema validation PASSED (${results.tablesChecked} tables, ${results.columnsChecked} columns)`));
            } else {
                console.log(colors.red(`  ✗ Step 3: Schema validation FAILED with ${results.issues.length} issues`));
            }

        } catch (error) {
            results.success = false;
            results.issues.push({
                severity: 'CRITICAL',
                message: `Schema validation exception: ${error.message}`
            });
        }

        return results;
    }
}

module.exports = SchemaValidator;
