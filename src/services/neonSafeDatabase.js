const { sequelize } = require('../../config/unified_database');

/**
 * NEON-TRANSACTION-SAFE DATABASE WRAPPER
 * 
 * COMPLETE REFACTOR - ALL database operations go through here
 * This is the ONLY way to interact with the database in Neon-safe mode
 */
class NeonSafeDatabase {
    constructor() {
        this.queryCount = 0;
        this.transactionCount = 0;
    }

    /**
     * Execute ANY database operation within transaction context
     * This is the SINGLE ENTRY POINT for all database operations
     */
    async execute(tenantId, operation, options = {}) {
        const executionId = ++this.queryCount;
        const txId = ++this.transactionCount;
        
        console.log(`🔐 [${executionId}] Starting Neon-safe execution for tenant: ${tenantId}`);
        
        let transaction;
        
        try {
            // Start transaction
            transaction = await sequelize.transaction({
                isolationLevel: options.isolationLevel || sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
                type: options.type || sequelize.Transaction.TYPES.DEFERRED
            });

            // Set tenant schema INSIDE transaction
            await sequelize.query(
                `SET search_path TO "tenant_${tenantId}", public`,
                { transaction, type: sequelize.QueryTypes.SET }
            );

            // Execute the operation
            const result = await operation(transaction, {
                tenantId,
                executionId,
                txId,
                sequelize
            });

            // Commit
            await transaction.commit();
            console.log(`✅ [${executionId}] Transaction committed successfully`);
            
            return {
                success: true,
                data: result,
                executionId,
                txId,
                tenantId
            };

        } catch (error) {
            // Rollback on any error
            if (transaction) {
                try {
                    await transaction.rollback();
                    console.log(`🔄 [${executionId}] Transaction rolled back`);
                } catch (rollbackError) {
                    console.error(`❌ [${executionId}] Rollback failed:`, rollbackError.message);
                }
            }

            console.error(`❌ [${executionId}] Execution failed:`, error.message);
            
            return {
                success: false,
                error: error.message,
                executionId,
                txId,
                tenantId
            };
        }
    }

    /**
     * Safe CREATE operation
     */
    async create(tenantId, model, data, options = {}) {
        return this.execute(tenantId, async (transaction) => {
            return await model.create(data, { ...options, transaction });
        });
    }

    /**
     * Safe FIND ALL operation
     */
    async findAll(tenantId, model, options = {}) {
        return this.execute(tenantId, async (transaction) => {
            return await model.findAll({ ...options, transaction });
        });
    }

    /**
     * Safe FIND ONE operation
     */
    async findOne(tenantId, model, options = {}) {
        return this.execute(tenantId, async (transaction) => {
            return await model.findOne({ ...options, transaction });
        });
    }

    /**
     * Safe UPDATE operation
     */
    async update(tenantId, model, data, options = {}) {
        return this.execute(tenantId, async (transaction) => {
            return await model.update(data, { ...options, transaction });
        });
    }

    /**
     * Safe DESTROY operation
     */
    async destroy(tenantId, model, options = {}) {
        return this.execute(tenantId, async (transaction) => {
            return await model.destroy({ ...options, transaction });
        });
    }

    /**
     * Safe RAW QUERY operation
     */
    async query(tenantId, sql, options = {}) {
        return this.execute(tenantId, async (transaction) => {
            return await sequelize.query(sql, { ...options, transaction });
        });
    }

    /**
     * Safe FIND AND COUNT ALL operation
     */
    async findAndCountAll(tenantId, model, options = {}) {
        return this.execute(tenantId, async (transaction) => {
            return await model.findAndCountAll({ ...options, transaction });
        });
    }

    /**
     * Safe COUNT operation
     */
    async count(tenantId, model, options = {}) {
        return this.execute(tenantId, async (transaction) => {
            return await model.count({ ...options, transaction });
        });
    }

    /**
     * Batch operations within single transaction
     */
    async batch(tenantId, operations) {
        return this.execute(tenantId, async (transaction, context) => {
            const results = [];
            
            for (let i = 0; i < operations.length; i++) {
                const operation = operations[i];
                try {
                    const result = await operation(transaction, context);
                    results.push({ success: true, data: result, index: i });
                } catch (error) {
                    results.push({ success: false, error: error.message, index: i });
                    if (operation.failFast !== false) {
                        throw error;
                    }
                }
            }
            
            return results;
        });
    }

    /**
     * Get execution statistics
     */
    getStats() {
        return {
            totalQueries: this.queryCount,
            totalTransactions: this.transactionCount,
            healthy: true
        };
    }
}

// Singleton instance
const neonSafeDB = new NeonSafeDatabase();

module.exports = neonSafeDB;
