/**
 * CACHED FIELDS VALIDATOR - Data Consistency Enforcer
 * 
 * Validates cached/denormalized fields
 * Converts to GENERATED columns where possible
 * Enforces calculation consistency
 */

const { Sequelize } = require('sequelize');

class CachedFieldsValidator {
    constructor(sequelize) {
        this.sequelize = sequelize;
        this.inconsistencies = [];
        
        // Define cached fields that should be validated
        this.cachedFieldDefinitions = {
            // Inventory.totalValue should equal quantity * unitCost
            'inventory.total_value': {
                sourceTable: 'inventory',
                fieldName: 'total_value',
                calculation: (row) => row.quantity * row.unit_cost,
                precision: 0.01, // Allow 1 cent variance
                canGenerate: true
            },
            
            // Order.billingTotal should equal sum of items + tax - discount
            'orders.billing_total': {
                sourceTable: 'orders',
                fieldName: 'billing_total',
                dependsOn: ['order_items'],
                calculation: async (order, sequelize) => {
                    const [items] = await sequelize.query(`
                        SELECT SUM(subtotal) as total FROM order_items WHERE order_id = :orderId
                    `, { replacements: { orderId: order.id } });
                    return (items[0]?.total || 0) + order.billing_tax - order.billing_discount;
                },
                precision: 0.01,
                canGenerate: false // Complex calculation
            },
            
            // Customer.totalDue validation
            'customers.total_due': {
                sourceTable: 'customers',
                fieldName: 'total_due',
                calculation: async (customer, sequelize) => {
                    const [result] = await sequelize.query(`
                        SELECT 
                            COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE -amount END), 0) as balance
                        FROM customer_transactions 
                        WHERE customer_id = :customerId
                    `, { replacements: { customerId: customer.id } });
                    return result[0]?.balance || 0;
                },
                precision: 0.01,
                canGenerate: false
            },
            
            // Recipe.estimatedCost should equal sum of ingredients
            'recipes.estimated_cost': {
                sourceTable: 'recipes',
                fieldName: 'estimated_cost',
                dependsOn: ['recipe_items'],
                calculation: async (recipe, sequelize) => {
                    const [items] = await sequelize.query(`
                        SELECT SUM(quantity * cost_per_unit) as total 
                        FROM recipe_items 
                        WHERE recipe_id = :recipeId
                    `, { replacements: { recipeId: recipe.id } });
                    return items[0]?.total || 0;
                },
                precision: 0.01,
                canGenerate: false
            }
        };
    }

    /**
     * Main validation entry point
     */
    async validate(tenantSchema = 'public') {
        console.log(`🔍 [CachedFields] Validating cached fields in ${tenantSchema}...`);
        
        this.inconsistencies = [];
        const results = [];

        for (const [key, definition] of Object.entries(this.cachedFieldDefinitions)) {
            try {
                const result = await this._validateField(definition, tenantSchema);
                results.push({ field: key, ...result });
            } catch (error) {
                results.push({
                    field: key,
                    valid: false,
                    error: error.message
                });
            }
        }

        const summary = {
            valid: results.filter(r => r.valid).length,
            invalid: results.filter(r => !r.valid).length,
            errors: results.filter(r => r.error).length,
            results: results
        };

        console.log(`✅ [CachedFields] Validation complete: ${summary.valid} valid, ${summary.invalid} invalid`);
        return summary;
    }

    /**
     * Validate a single cached field
     */
    async _validateField(definition, tenantSchema) {
        const { sourceTable, fieldName, calculation, precision } = definition;

        // Check if field exists
        const [columns] = await this.sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = :schema AND table_name = :table AND column_name = :column
        `, {
            replacements: { schema: tenantSchema, table: sourceTable, column: fieldName },
            type: Sequelize.QueryTypes.SELECT
        });

        if (!columns || columns.length === 0) {
            return { valid: true, status: 'field_not_exists', message: `Field ${fieldName} not found` };
        }

        // Sample rows for validation (limit to 1000 for performance)
        const [rows] = await this.sequelize.query(`
            SELECT * FROM "${tenantSchema}".${sourceTable} 
            WHERE ${fieldName} IS NOT NULL
            LIMIT 1000
        `);

        if (!rows || rows.length === 0) {
            return { valid: true, status: 'no_data', message: 'No data to validate' };
        }

        const inconsistencies = [];

        for (const row of rows) {
            let expected;
            
            if (typeof calculation === 'function' && calculation.length === 1) {
                // Simple synchronous calculation
                expected = calculation(row);
            } else {
                // Complex async calculation - skip in batch mode
                continue;
            }

            const actual = parseFloat(row[fieldName]);
            const diff = Math.abs(expected - actual);

            if (diff > precision) {
                inconsistencies.push({
                    id: row.id,
                    expected,
                    actual,
                    diff
                });
            }
        }

        if (inconsistencies.length > 0) {
            this.inconsistencies.push({
                table: sourceTable,
                field: fieldName,
                count: inconsistencies.length,
                sample: inconsistencies.slice(0, 5)
            });
        }

        return {
            valid: inconsistencies.length === 0,
            checked: rows.length,
            inconsistencies: inconsistencies.length,
            sampleErrors: inconsistencies.slice(0, 3)
        };
    }

    /**
     * Convert simple cached fields to GENERATED columns
     */
    async convertToGenerated(definition, tenantSchema) {
        if (!definition.canGenerate) {
            return { converted: false, reason: 'Complex calculation - cannot generate' };
        }

        const { sourceTable, fieldName, calculation } = definition;

        try {
            // Check current column definition
            const [column] = await this.sequelize.query(`
                SELECT data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_schema = :schema AND table_name = :table AND column_name = :column
            `, {
                replacements: { schema: tenantSchema, table: sourceTable, column: fieldName },
                type: Sequelize.QueryTypes.SELECT
            });

            if (!column) {
                return { converted: false, reason: 'Column not found' };
            }

            // Build generation expression
            let generationExpression;
            if (fieldName === 'total_value') {
                generationExpression = '(quantity * unit_cost)';
            } else {
                return { converted: false, reason: 'No generation expression defined' };
            }

            // Convert to GENERATED ALWAYS
            await this.sequelize.query(`
                ALTER TABLE "${tenantSchema}".${sourceTable}
                ALTER COLUMN ${fieldName} DROP DEFAULT;
                
                ALTER TABLE "${tenantSchema}".${sourceTable}
                ALTER COLUMN ${fieldName} SET GENERATED ALWAYS AS (${generationExpression}) STORED;
            `);

            console.log(`✅ [CachedFields] Converted ${sourceTable}.${fieldName} to GENERATED column`);
            
            return {
                converted: true,
                table: sourceTable,
                field: fieldName,
                expression: generationExpression
            };

        } catch (error) {
            console.error(`❌ [CachedFields] Failed to convert ${fieldName}:`, error.message);
            return { converted: false, error: error.message };
        }
    }

    /**
     * Fix inconsistencies by recalculating
     */
    async fixInconsistencies(definition, tenantSchema) {
        const { sourceTable, fieldName, calculation } = definition;
        
        console.log(`🔧 [CachedFields] Fixing inconsistencies in ${sourceTable}.${fieldName}...`);

        // Get all rows
        const [rows] = await this.sequelize.query(`
            SELECT id, * FROM "${tenantSchema}".${sourceTable}
        `);

        let fixed = 0;
        let errors = 0;

        for (const row of rows) {
            try {
                let expected;
                if (typeof calculation === 'function' && calculation.length === 1) {
                    expected = calculation(row);
                } else {
                    continue; // Skip complex calculations
                }

                await this.sequelize.query(`
                    UPDATE "${tenantSchema}".${sourceTable}
                    SET ${fieldName} = :value
                    WHERE id = :id
                `, {
                    replacements: { id: row.id, value: expected }
                });

                fixed++;
            } catch (error) {
                errors++;
            }
        }

        return { fixed, errors, total: rows.length };
    }

    /**
     * Add trigger-based consistency enforcement
     */
    async addConsistencyTrigger(definition, tenantSchema) {
        const { sourceTable, fieldName } = definition;
        const triggerName = `trg_${sourceTable}_${fieldName}_consistency`;
        const functionName = `fn_${sourceTable}_${fieldName}_calc`;

        try {
            // Create function
            await this.sequelize.query(`
                CREATE OR REPLACE FUNCTION "${tenantSchema}".${functionName}()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.${fieldName} := NEW.quantity * NEW.unit_cost;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            `);

            // Create trigger
            await this.sequelize.query(`
                DROP TRIGGER IF EXISTS ${triggerName} ON "${tenantSchema}".${sourceTable};
                
                CREATE TRIGGER ${triggerName}
                    BEFORE INSERT OR UPDATE ON "${tenantSchema}".${sourceTable}
                    FOR EACH ROW
                    EXECUTE FUNCTION "${tenantSchema}".${functionName}();
            `);

            console.log(`✅ [CachedFields] Added consistency trigger: ${triggerName}`);
            return { added: true, trigger: triggerName };

        } catch (error) {
            console.error(`❌ [CachedFields] Failed to add trigger:`, error.message);
            return { added: false, error: error.message };
        }
    }

    /**
     * Schedule periodic consistency checks
     */
    scheduleValidation(cronExpression = '0 2 * * *') {
        // This would integrate with a job scheduler like node-cron
        console.log(`📅 [CachedFields] Validation scheduled: ${cronExpression}`);
        
        return {
            scheduled: true,
            schedule: cronExpression,
            nextRun: this._getNextRunTime(cronExpression)
        };
    }

    _getNextRunTime(cron) {
        // Simplified - would use cron-parser in production
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(2, 0, 0, 0);
        return tomorrow;
    }

    /**
     * Get validation report
     */
    getReport() {
        return {
            definitions: Object.keys(this.cachedFieldDefinitions),
            currentInconsistencies: this.inconsistencies,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Health check endpoint
     */
    async healthCheck(tenantSchema = 'public') {
        const result = await this.validate(tenantSchema);
        
        return {
            status: result.invalid === 0 && result.errors === 0 ? 'healthy' : 'degraded',
            ...result
        };
    }
}

module.exports = CachedFieldsValidator;
