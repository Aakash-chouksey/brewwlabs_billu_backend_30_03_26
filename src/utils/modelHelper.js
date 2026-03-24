const { sequelize } = require('../../config/unified_database');

// PHASE 4 FIX: Global model cache - initialized once
let cachedModels = null;

/**
 * Get all models - uses global cache
 * @param {object} transaction - Optional transaction context (for schema-bound models)
 * @returns {object} Initialized models
 */
const getModels = (transaction) => {
    // PHASE 2 FIX: PRIORITIZE TRANSACTION-SCOPED MODELS
    // These are injected by neonTransactionSafeExecutor and are schema-bound
    if (transaction?.models && Object.keys(transaction.models).length > 0) {
        return transaction.models;
    }

    // Return global cached models
    if (cachedModels) {
        return cachedModels;
    }

    // Fallback to sequelize instance models if available
    const db = transaction?.sequelize || transaction || sequelize;
    if (db?.models && Object.keys(db.models).length > 0) {
        cachedModels = db.models;
        return cachedModels;
    }

    throw new Error("🚨 Models not initialized. Ensure ModelFactory.createModels was called at startup.");
};

/**
 * Ensure models are initialized (Async version) - DEPRECATED
 * Now models are cached globally, this should only be called once at startup
 */
const ensureModels = async (connection = null) => {
    if (cachedModels) {
        return cachedModels;
    }
    
    const { ModelFactory } = require('../architecture/modelFactory');
    const db = (connection && connection.sequelize) ? connection.sequelize : (connection || sequelize);
    cachedModels = await ModelFactory.createModels(db);
    return cachedModels;
};

module.exports = { 
    getModels,
    ensureModels
};
