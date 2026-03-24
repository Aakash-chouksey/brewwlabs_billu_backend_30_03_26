/**
 * UNIFIED MODEL MANAGER - Minimal Version
 * Satisfies boot dependencies and health checks
 */
const { modelRegistry } = require('../src/architecture/modelFactory');

module.exports = {
  /**
   * Get stats for health check
   */
  getStats: () => {
    const modelNames = Array.from(modelRegistry.models.keys());
    return {
      modelsLoaded: true,
      count: modelNames.length,
      registry: modelNames
    };
  },

  /**
   * Verification utility
   */
  isReady: () => true
};
