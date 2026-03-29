/**
 * TRANSACTION GUARD
 * Enforces transaction requirement for all multi-tenant database operations
 * Prevents accidental non-transactional queries that could break tenant isolation
 */

const { sequelize } = require('../config/unified_database');

/**
 * Guard function - throws if transaction is not provided
 * Use this at the start of critical service functions
 */
function requireTransaction(options, operationName = 'Database operation') {
    if (!options || !options.transaction) {
        const error = new Error(
            `[TRANSACTION GUARD] ${operationName} requires a transaction for multi-tenant safety. ` +
            `Use: await sequelize.transaction(async (t) => { /* your code */ })`
        );
        error.code = 'TRANSACTION_REQUIRED';
        error.status = 500;
        throw error;
    }
    return true;
}

/**
 * Soft guard - logs warning but doesn't throw (for gradual migration)
 */
function warnIfNoTransaction(options, operationName = 'Database operation') {
    if (!options || !options.transaction) {
        console.warn(
            `[TRANSACTION GUARD] WARNING: ${operationName} executed without transaction. ` +
            `This may cause tenant isolation issues.`
        );
        return false;
    }
    return true;
}

/**
 * Sequelize CLS (Continuation Local Storage) Setup
 * Automatically passes transaction through async call stack
 * This ensures transaction is available without explicit passing
 */
function setupTransactionCLS() {
    // Enable CLS for automatic transaction passing
    const cls = require('cls-hooked');
    const namespace = cls.createNamespace('transaction-namespace');
    
    // Patch Sequelize to use CLS
    const Sequelize = require('sequelize');
    Sequelize.useCLS(namespace);
    
    console.log('[TRANSACTION GUARD] ✅ CLS enabled for automatic transaction propagation');
    
    return namespace;
}

/**
 * Transaction wrapper with automatic retry
 * Wraps operations in transaction with built-in retry logic
 */
async function withTransaction(operation, options = {}) {
    const { maxRetries = 3, retryDelay = 100 } = options;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const transaction = await sequelize.transaction();
        
        try {
            const result = await operation(transaction);
            await transaction.commit();
            return result;
        } catch (error) {
            await transaction.rollback().catch(() => {});
            lastError = error;
            
            // Don't retry on fatal errors
            if (error.code === 'TRANSACTION_REQUIRED' || 
                error.message?.includes('permission denied')) {
                throw error;
            }
            
            if (attempt < maxRetries) {
                console.log(`[TRANSACTION GUARD] Retry ${attempt}/${maxRetries} after error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }
    
    throw lastError;
}

/**
 * Query interceptor - logs all queries without transaction in development
 * Helps identify non-transactional queries during development
 */
function setupQueryInterceptor() {
    if (process.env.NODE_ENV !== 'development') return;
    
    const originalQuery = sequelize.query.bind(sequelize);
    
    sequelize.query = async function(sql, options = {}) {
        // Check if this is a SELECT/INSERT/UPDATE/DELETE without transaction
        const isDataQuery = /^(SELECT|INSERT|UPDATE|DELETE)/i.test(sql);
        const hasTransaction = options.transaction || sequelize.Sequelize._cls?.get('transaction');
        
        if (isDataQuery && !hasTransaction) {
            console.warn(
                `[TRANSACTION GUARD] Non-transactional query detected:\n` +
                `SQL: ${sql.substring(0, 100)}...\n` +
                `Stack: ${new Error().stack.split('\n')[2]}`
            );
        }
        
        return originalQuery(sql, options);
    };
}

module.exports = {
    requireTransaction,
    warnIfNoTransaction,
    setupTransactionCLS,
    withTransaction,
    setupQueryInterceptor
};
