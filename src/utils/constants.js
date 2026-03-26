/**
 * System Constants
 */

module.exports = {
    /**
     * The identifier for the shared management/admin context.
     * All global operations (Auth, Onboarding, Tenant Validation)
     * occur within this context.
     */
    CONTROL_PLANE: 'control_plane',
    
    /**
     * Default schema for control plane operations
     */
    PUBLIC_SCHEMA: 'public',
    
    /**
     * Tenant schema prefix
     */
    TENANT_SCHEMA_PREFIX: 'tenant_',

    /**
     * 🔒 CONTROL MODELS (Public Schema ONLY)
     * These models represent the platform infrastructure and 
     * reside strictly in the 'public' schema.
     */
    CONTROL_MODELS: [
        'Business',
        'User', 
        'TenantRegistry',
        'ClusterMetadata',
        'Plan',
        'Subscription',
        'SuperAdminUser',
        'TenantConnection',
        'TenantMigrationLog',
        'SystemMetrics',
        'AuditLog', // Platform Audit Log
        'Auth'
    ],

    /**
     * 🏘️ TENANT MODELS (Tenant Schema ONLY)
     * These represent business data for a specific tenant.
     */
    TENANT_MODELS: [
        'Account', 'Area', 'BillingConfig', 'Category', 'Customer',
        'CustomerLedger', 'CustomerTransaction', 'Expense', 'ExpenseType',
        'FeatureFlag', 'Income', 'Inventory', 'InventoryCategory',
        'InventoryItem', 'InventorySale', 'InventoryTransaction',
        'MembershipPlan', 'OperationTiming', 'Order', 'OrderItem',
        'Outlet', 'PartnerMembership', 'PartnerType', 'PartnerWallet',
        'Payment', 'Product', 'ProductType', 'Purchase', 'PurchaseItem',
        'Recipe', 'RecipeItem', 'RollTracking', 'Setting', 'StockTransaction',
        'Supplier', 'Table', 'TenantAuditLog', 'Timing', 'AccountTransaction',
        'Wastage', 'WebContent'
    ]
};

// 🔒 Freeze to prevent runtime tampering
Object.freeze(module.exports.CONTROL_MODELS);
Object.freeze(module.exports.TENANT_MODELS);
