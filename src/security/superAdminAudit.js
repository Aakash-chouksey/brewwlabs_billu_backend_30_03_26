/**
 * SUPERADMIN AUDIT LOGGER
 * 
 * Logs all SuperAdmin tenant switching and actions
 * Ensures complete audit trail for compliance
 */

const { ControlPlaneModels } = require('../controlPlaneModels');

/**
 * Log SuperAdmin action
 */
async function logSuperAdminAction({
    adminId,
    tenantId = null,
    action,
    route,
    details = {},
    ipAddress,
    userAgent
}) {
    try {
        await ControlPlaneModels.AuditLog.create({
            adminId,
            tenantId,
            action,
            route,
            details: JSON.stringify(details),
            ipAddress,
            userAgent,
            timestamp: new Date(),
            severity: 'INFO'
        });
        
        console.log(`🔐 SUPERADMIN AUDIT: ${action} by admin ${adminId}${tenantId ? ` for tenant ${tenantId}` : ''}`);
    } catch (error) {
        console.error('🔐 AUDIT LOG ERROR:', error.message);
    }
}

/**
 * Log tenant switching
 */
async function logTenantSwitch(adminId, fromTenantId, toTenantId, ipAddress, userAgent) {
    await logSuperAdminAction({
        adminId,
        tenantId: toTenantId,
        action: 'TENANT_SWITCH',
        route: '/api/superadmin/switch-tenant',
        details: {
            fromTenantId,
            toTenantId
        },
        ipAddress,
        userAgent
    });
}

/**
 * Log tenant data access
 */
async function logTenantDataAccess(adminId, tenantId, action, details, ipAddress, userAgent) {
    await logSuperAdminAction({
        adminId,
        tenantId,
        action,
        route: `/api/superadmin/${action}`,
        details,
        ipAddress,
        userAgent
    });
}

module.exports = {
    logSuperAdminAction,
    logTenantSwitch,
    logTenantDataAccess
};
