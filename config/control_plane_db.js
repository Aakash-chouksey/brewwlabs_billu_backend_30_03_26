const { sequelize, connectUnifiedDB } = require('./unified_database');

/**
 * 🛠️ CONTROL PLANE CONSOLIDATION
 * 
 * In the Neon-safe architecture, we use a SINGLE Sequelize instance
 * to manage all schemas (public + tenant_xxx). This ensures 
 * transaction-safe cross-schema operations (atomic onboarding).
 */

const controlPlaneSequelize = sequelize;

/**
 * Initialize control plane models and sync tables
 * Ensures all control plane tables exist in public schema
 */
const initializeControlPlaneModels = async () => {
    try {
        console.log('🏗️ Initializing control plane models...');
        
        const controlModels = require('../control_plane_models');
        await controlModels.init();
        
        // Use constants to get all control model names
        const { CONTROL_MODELS } = require('../src/utils/constants');
        
        console.log(`📊 Syncing ${CONTROL_MODELS.length} control models to public schema...`);
        
        for (const modelName of CONTROL_MODELS) {
            const model = controlPlaneSequelize.models[modelName];
            if (model) {
                await model.schema('public').sync({ alter: true });
                console.log(`✅ ${modelName} table ready in public schema`);
            } else {
                console.warn(`⚠️ Model ${modelName} not found in sequelize instance`);
            }
        }
        
        console.log('✅ Control plane models fully initialized');
        return true;
    } catch (error) {
        console.error('❌ Control plane model initialization failed:', error.message);
        throw error;
    }
};

/**
 * Validate control plane database connection
 * Used during app initialization
 */
const validateControlPlane = async () => {
    try {
        await controlPlaneSequelize.authenticate();
        console.log('✅ Control Plane validation successful (via Unified Instance)');
        
        // Initialize and sync control plane models
        await initializeControlPlaneModels();
        
        return true;
    } catch (error) {
        console.error('⚠️ Control Plane validation failed:', error.message);
        return false;
    }
};

module.exports = { 
  controlPlaneSequelize,
  validateControlPlane,
  initializeControlPlaneModels
};
