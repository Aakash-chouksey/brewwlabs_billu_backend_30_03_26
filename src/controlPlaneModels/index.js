// Control Plane Models - Platform-level entities only
// Used for SuperAdmin operations, tenant management, and system-wide data

const { controlPlaneSequelize } = require('../../control_plane_models');

// Control Plane Models (Platform-level)
const ControlPlaneModels = {
    // Tenant Management
    TenantConnection: require('../../control_plane_models').TenantConnection,
    
    // SuperAdmin Users
    SuperAdminUser: require('../../control_plane_models').User,
    
    // Business/Brand Management
    Business: require('../../control_plane_models').Business,
    
    // Subscription Management
    Subscription: require('../../control_plane_models').Subscription,
    
    // Audit Logging
    AuditLog: require('../../control_plane_models').AuditLog,
    
    // System Settings
    Setting: require('../../control_plane_models').Setting,
    
    // Get the control plane sequelize instance
    sequelize: controlPlaneSequelize
};

module.exports = ControlPlaneModels;
