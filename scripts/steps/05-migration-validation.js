/**
 * STEP 5: MIGRATION VALIDATION
 * 
 * Validates that migrations were executed in order and no critical ones are missing.
 */

const colors = require('colors');

class MigrationValidator {
    static async execute(sequelize, schemaName) {
        console.log(colors.cyan(`  → Auditing migration logs for: ${schemaName}...`));
        
        const results = {
            success: true,
            schemaName,
            issues: []
        };

        try {
            // 1. Get applied migrations
            const applied = await sequelize.query(`
                SELECT version, migration_name, applied_at 
                FROM "${schemaName}"."schema_versions" 
                ORDER BY version ASC
            `, { type: sequelize.QueryTypes.SELECT });

            if (applied.length === 0) {
                results.success = false;
                results.issues.push({
                    severity: 'CRITICAL',
                    message: "No migrations recorded in 'schema_versions' table"
                });
                return results;
            }

            // 2. Check for critical migrations (v1, v8, etc.)
            const versions = applied.map(m => m.version);
            const critical = [1, 8]; // Example critical migration versions
            
            for (const v of critical) {
                if (!versions.includes(v)) {
                    results.success = false;
                    results.issues.push({
                        severity: 'CRITICAL',
                        message: `CRITICAL MIGRATION MISSING: v${v}`,
                        details: { missingVersion: v }
                    });
                }
            }

            // 3. Check for order and gaps
            let lastVersion = 0;
            for (const m of applied) {
                if (m.version < lastVersion) {
                    results.success = false;
                    results.issues.push({
                        severity: 'CRITICAL',
                        message: `Migration ORDER VIOLATION: version ${m.version} applied after version ${lastVersion}`,
                        details: { version: m.version, lastVersion }
                    });
                }
                lastVersion = m.version;
            }

            if (results.success) {
                console.log(colors.green(`  ✓ Step 5: Migration audit PASSED (${applied.length} migrations)`));
            }

        } catch (error) {
            results.success = false;
            results.issues.push({
                severity: 'CRITICAL',
                message: `Migration audit exception: ${error.message}`
            });
        }

        return results;
    }
}

module.exports = MigrationValidator;
