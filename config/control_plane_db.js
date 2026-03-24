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
 * Validate control plane database connection
 * Used during app initialization
 */
const validateControlPlane = async () => {
    try {
        await controlPlaneSequelize.authenticate();
        console.log('✅ Control Plane validation successful (via Unified Instance)');
        return true;
    } catch (error) {
        console.error('⚠️ Control Plane validation failed:', error.message);
        return false;
    }
};

module.exports = { 
  controlPlaneSequelize,
  validateControlPlane
};
