/**
 * STEP 1: DATABASE RESET + CLEAN START
 * 
 * Drops all tenant schemas and clears control plane tables
 * to ensure a fresh testing environment.
 */

const colors = require('colors');

class DatabaseReset {
    static async execute(sequelize) {
        console.log(colors.cyan('  → Dropping all tenant schemas...'));
        
        const results = {
            success: true,
            schemasDropped: 0,
            tablesCleared: [],
            errors: []
        };

        try {
            // Get all schemas except public and system schemas
            const schemas = await sequelize.query(`
                SELECT schema_name 
                FROM information_schema.schemata 
                WHERE schema_name LIKE 'tenant_%'
                ORDER BY schema_name
            `, { type: sequelize.QueryTypes.SELECT });

            // Drop each tenant schema
            for (const { schema_name } of schemas) {
                try {
                    await sequelize.query(`DROP SCHEMA IF EXISTS "${schema_name}" CASCADE`);
                    console.log(colors.gray(`    ✓ Dropped schema: ${schema_name}`));
                    results.schemasDropped++;
                } catch (err) {
                    results.errors.push({ schema: schema_name, error: err.message });
                    console.log(colors.red(`    ✗ Failed to drop ${schema_name}: ${err.message}`));
                }
            }

            // Clear control plane tables
            console.log(colors.cyan('  → Clearing control plane tables...'));
            
            const tablesToClear = ['tenant_registry', 'businesses', 'users'];
            
            for (const table of tablesToClear) {
                try {
                    // Check if table exists
                    const tableExists = await sequelize.query(`
                        SELECT 1 FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = :table
                    `, { 
                        replacements: { table },
                        type: sequelize.QueryTypes.SELECT 
                    });

                    if (tableExists.length > 0) {
                        await sequelize.query(`TRUNCATE TABLE "public"."${table}" CASCADE`);
                        console.log(colors.gray(`    ✓ Cleared table: ${table}`));
                        results.tablesCleared.push(table);
                    }
                } catch (err) {
                    results.errors.push({ table, error: err.message });
                    console.log(colors.yellow(`    ⚠ Could not clear ${table}: ${err.message}`));
                }
            }

            // Verify public schema is clean
            console.log(colors.cyan('  → Verifying clean state...'));
            
            const remainingTenants = await sequelize.query(`
                SELECT COUNT(*) as count FROM public.tenant_registry
            `, { type: sequelize.QueryTypes.SELECT });

            const remainingBusinesses = await sequelize.query(`
                SELECT COUNT(*) as count FROM public.businesses
            `, { type: sequelize.QueryTypes.SELECT });

            if (remainingTenants[0].count > 0 || remainingBusinesses[0].count > 0) {
                results.success = false;
                results.errors.push({
                    severity: 'CRITICAL',
                    message: `Control plane not clean: ${remainingTenants[0].count} tenants, ${remainingBusinesses[0].count} businesses remaining`
                });
            }

            // Verify no tenant schemas remain
            const remainingSchemas = await sequelize.query(`
                SELECT COUNT(*) as count 
                FROM information_schema.schemata 
                WHERE schema_name LIKE 'tenant_%'
            `, { type: sequelize.QueryTypes.SELECT });

            if (remainingSchemas[0].count > 0) {
                results.success = false;
                results.errors.push({
                    severity: 'CRITICAL',
                    message: `${remainingSchemas[0].count} tenant schemas still exist after cleanup`
                });
            }

            if (results.success) {
                console.log(colors.green(`  ✓ Database reset complete: ${results.schemasDropped} schemas dropped, ${results.tablesCleared.length} tables cleared`));
            }

        } catch (error) {
            results.success = false;
            results.errors.push({
                severity: 'CRITICAL',
                message: `Database reset failed: ${error.message}`,
                stack: error.stack
            });
        }

        return results;
    }
}

module.exports = DatabaseReset;
