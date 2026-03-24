const { DataTypes } = require('sequelize');
const { controlPlaneSequelize } = require('../config/control_plane_db');

// Check if we have a real database connection
const isRealConnection = controlPlaneSequelize && controlPlaneSequelize.define && typeof controlPlaneSequelize.define === 'function';

// Lazily initialize models and export them.
let Business, TenantConnection, Subscription, SuperAdminUser, ClusterMetadata, TenantMigrationLog, Plan, AuditLog, TenantRegistry, SystemMetrics;

if (isRealConnection) {
  // Real database connection - create real models
  Business = require('./businessModel')(controlPlaneSequelize, DataTypes);
  TenantConnection = require('./tenantConnectionModel')(controlPlaneSequelize, DataTypes);
  Subscription = require('./subscriptionModel')(controlPlaneSequelize, DataTypes);
  SuperAdminUser = require('./superAdminModel')(controlPlaneSequelize, DataTypes);
  ClusterMetadata = require('./clusterMetadataModel')(controlPlaneSequelize, DataTypes);
  TenantMigrationLog = require('./tenantMigrationLogModel')(controlPlaneSequelize, DataTypes);
  Plan = require('./planModel')(controlPlaneSequelize, DataTypes);
  AuditLog = require('./auditLogModel').AuditLog;
  TenantRegistry = require('./tenantRegistryModel')(controlPlaneSequelize, DataTypes);
  SystemMetrics = require('./systemMetricsModel')(controlPlaneSequelize, DataTypes);

  // Define Associations
  Business.hasOne(TenantConnection, { foreignKey: 'businessId', as: 'connection' });
  TenantConnection.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });

  Plan.hasMany(Subscription, { foreignKey: 'planId', as: 'subscriptions' });
  Subscription.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });
  Subscription.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });
  Business.hasMany(Subscription, { foreignKey: 'businessId', as: 'subscriptions' });

  Business.hasOne(TenantRegistry, { foreignKey: 'businessId', as: 'registry' });
  TenantRegistry.belongsTo(Business, { foreignKey: 'businessId', as: 'business' });
} else {
  // No database connection - create all placeholder models
  const createPlaceholderModel = require('./placeholderModel');
  
  Business = createPlaceholderModel(controlPlaneSequelize);
  TenantConnection = createPlaceholderModel(controlPlaneSequelize);
  Subscription = createPlaceholderModel(controlPlaneSequelize);
  SuperAdminUser = createPlaceholderModel(controlPlaneSequelize);
  ClusterMetadata = createPlaceholderModel(controlPlaneSequelize);
  TenantMigrationLog = createPlaceholderModel(controlPlaneSequelize);
  Plan = createPlaceholderModel(controlPlaneSequelize);
  AuditLog = createPlaceholderModel(controlPlaneSequelize);
  TenantRegistry = createPlaceholderModel(controlPlaneSequelize);
  SystemMetrics = createPlaceholderModel(controlPlaneSequelize);
}

const init = async (options = { sync: false }) => {
  if (options.sync && isRealConnection) {
    console.warn('⚠️ Global sync requested but disabled for strict isolation. Use dedicated scripts for synchronization.');
  }
};

module.exports = {
  controlPlaneSequelize,
  Business,
  TenantConnection,
  Subscription,
  SuperAdminUser,
  ClusterMetadata,
  TenantMigrationLog,
  Plan,
  AuditLog,
  TenantRegistry,
  SystemMetrics,
  init
};
