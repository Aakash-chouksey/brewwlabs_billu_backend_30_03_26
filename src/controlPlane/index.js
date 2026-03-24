// Control Plane Models - Platform-level entities only
// Used for SuperAdmin operations, tenant management, and system-wide data

const controlPlaneModels = require('../../control_plane_models');

// Control Plane Models (Platform-level)
const ControlPlaneModels = {
    // Tenant Management
    TenantConnection: controlPlaneModels.TenantConnection,
    
    // SuperAdmin Users (mapped to User for consistency)
    User: controlPlaneModels.SuperAdminUser,
    
    // Business/Brand Management
    Business: controlPlaneModels.Brand,
    
    // Subscription Management
    Subscription: controlPlaneModels.Subscription,
    
    // Audit Logging
    AuditLog: controlPlaneModels.TenantMigrationLog, // Using available model
    
    // Cluster Metadata
    ClusterMetadata: controlPlaneModels.ClusterMetadata,
    
    // Outlet and Setting models (placeholder implementations)
    Outlet: controlPlaneModels.Outlet,
    Setting: controlPlaneModels.Setting,
    
    // New placeholder models
    WebContent: controlPlaneModels.WebContent,
    PartnerWallet: controlPlaneModels.PartnerWallet,
    MembershipPlan: controlPlaneModels.MembershipPlan,
    PartnerType: controlPlaneModels.PartnerType,
    PartnerMembership: controlPlaneModels.PartnerMembership,
    Order: controlPlaneModels.Order,
    
    // Sequelize instance
    sequelize: controlPlaneModels.controlPlaneSequelize
};

module.exports = { ControlPlaneModels };
