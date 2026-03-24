/**
 * CENTRALIZED MODEL ASSOCIATIONS SETUP
 * 
 * STRICT RULE: This is the ONLY place where models can be initialized.
 * All other files MUST use req.models to access models.
 * 
 * NO DIRECT IMPORTS ALLOWED ANYWHERE ELSE!
 */

const { ModelFactory } = require('../src/architecture/modelFactory');

const setupAssociations = async (sequelize) => {
    // If models are already initialized on this sequelize instance, just return them
    // This prevents re-definition errors in singleton environments
    if (sequelize._modelsInitialized) {
        return sequelize.models;
    }

    console.log('🏭 Initializing models through centralized factory...');

    // Use the centralized model factory
    const models = await ModelFactory.createModels(sequelize);

    // Validate all required models are present
    ModelFactory.validateModels(models);

    // Store models on sequelize instance for caching
    sequelize.models = models;
    sequelize._modelsInitialized = true;

    console.log(`✅ Initialized ${Object.keys(models).length} models and associations`);

    return models;
};

module.exports = setupAssociations;
