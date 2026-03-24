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
    TENANT_SCHEMA_PREFIX: 'tenant_'
};
