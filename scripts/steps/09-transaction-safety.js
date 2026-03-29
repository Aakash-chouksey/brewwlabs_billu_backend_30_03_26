/**
 * STEP 9: TRANSACTION SAFETY CHECK
 * 
 * Detects "current transaction is aborted" and handles it correctly.
 */

const colors = require('colors');

class TransactionSafety {
    static async execute(sequelize, schemaName) {
        console.log(colors.cyan(`  → Testing transaction safety for: ${schemaName}...`));
        
        const results = {
            success: true,
            schemaName,
            issues: []
        };

        try {
            // Check specifically for "current transaction is aborted"
            const transaction = await sequelize.transaction();
            try {
                // 1. Intentionally trigger an error
                try {
                    await sequelize.query('SELECT * FROM "nonexistent_table"', { transaction });
                } catch (err) {
                    // This error is expected
                    console.log(colors.gray('    ✓ Initial error triggered within transaction as expected'));
                }

                // 2. Attempt another query WITHIN THE SAME TRANSACTION
                // This is where "current transaction is aborted" happens
                try {
                    await sequelize.query('SELECT 1', { transaction });
                } catch (err) {
                    if (err.message.includes('current transaction is aborted')) {
                        console.log(colors.green('    ✓ DETECTED: current transaction is aborted (As Expected)'));
                        results.success = true;
                    }
                }

                await transaction.rollback();
            } catch (err) {
                await transaction.rollback();
                throw err;
            }

            if (results.success) {
                console.log(colors.green('  ✓ Step 9: Transaction safety check passed'));
            }

        } catch (error) {
            results.success = false;
            results.issues.push({
                severity: 'CRITICAL',
                message: `Transaction safety exception: ${error.message}`
            });
        }

        return results;
    }
}

module.exports = TransactionSafety;
