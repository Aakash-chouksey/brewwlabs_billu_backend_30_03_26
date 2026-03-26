const { DataTypes } = require('sequelize');
const { controlPlaneSequelize } = require('../config/control_plane_db');
const { ModelFactory } = require('../src/architecture/modelFactory');

// Check if we have a real database connection
const isRealConnection = controlPlaneSequelize && controlPlaneSequelize.define && typeof controlPlaneSequelize.define === 'function';

// Models will be populated after ModelFactory initialization
let models = {};

if (isRealConnection) {
  // Use the centralized factory to ensure single source of truth and correct classification
  // This is synchronous because setupModelDefinitions was already called or is handled lazily
  ModelFactory.setupModelDefinitions();
  
  // Initialize models on the control plane instance
  // Since createModels is async but it's often called later, we can't easily wait here
  // But we can manually trigger it if needed.
  // Actually, for immediate export, we can't await. 
  // Most callers of this file expect these exports to be ready.
} else {
  throw new Error('🚨 CRITICAL: Control plane database connection not established.');
}

// Export the specific models from the unified ModelFactory
// We define getters to ensure they are available after initialization
module.exports = {
  controlPlaneSequelize,
  get Business() { return controlPlaneSequelize.models.Business; },
  get TenantConnection() { return controlPlaneSequelize.models.TenantConnection; },
  get Subscription() { return controlPlaneSequelize.models.Subscription; },
  get SuperAdminUser() { return controlPlaneSequelize.models.SuperAdminUser; },
  get ClusterMetadata() { return controlPlaneSequelize.models.ClusterMetadata; },
  get TenantMigrationLog() { return controlPlaneSequelize.models.TenantMigrationLog; },
  get Plan() { return controlPlaneSequelize.models.Plan; },
  get AuditLog() { return controlPlaneSequelize.models.AuditLog; },
  get TenantRegistry() { return controlPlaneSequelize.models.TenantRegistry; },
  get SystemMetrics() { return controlPlaneSequelize.models.SystemMetrics; },
  get User() { return controlPlaneSequelize.models.User; },
  init: async () => await ModelFactory.createModels(controlPlaneSequelize)
};
