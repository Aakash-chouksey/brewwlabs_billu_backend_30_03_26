const createHttpError = require('http-errors');

/**
 * Role-Based Access Control Middleware
 * Enforces proper role-based permissions for different routes
 */

// Role hierarchy for permission checking
const ROLE_HIERARCHY = {
    'SUPER_ADMIN': 100,
    'BusinessAdmin': 80,
    'Manager': 60,
    'Staff': 40,
    'User': 20
};

// Permission definitions
const PERMISSIONS = {
    // User Management
    'USER_CREATE': ['SUPER_ADMIN', 'BusinessAdmin'],
    'USER_READ': ['SUPER_ADMIN', 'BusinessAdmin', 'Manager', 'Staff'],
    'USER_UPDATE': ['SUPER_ADMIN', 'BusinessAdmin', 'Manager'],
    'USER_DELETE': ['SUPER_ADMIN', 'BusinessAdmin'],
    
    // Business Management
    'BUSINESS_CREATE': ['SUPER_ADMIN'],
    'BUSINESS_READ': ['SUPER_ADMIN', 'BusinessAdmin', 'Manager'],
    'BUSINESS_UPDATE': ['SUPER_ADMIN', 'BusinessAdmin'],
    'BUSINESS_DELETE': ['SUPER_ADMIN'],
    
    // Product Management
    'PRODUCT_CREATE': ['SUPER_ADMIN', 'BusinessAdmin', 'Manager'],
    'PRODUCT_READ': ['SUPER_ADMIN', 'BusinessAdmin', 'Manager', 'Staff'],
    'PRODUCT_UPDATE': ['SUPER_ADMIN', 'BusinessAdmin', 'Manager'],
    'PRODUCT_DELETE': ['SUPER_ADMIN', 'BusinessAdmin'],
    
    // Order Management
    'ORDER_CREATE': ['SUPER_ADMIN', 'BusinessAdmin', 'Manager', 'Staff'],
    'ORDER_READ': ['SUPER_ADMIN', 'BusinessAdmin', 'Manager', 'Staff'],
    'ORDER_UPDATE': ['SUPER_ADMIN', 'BusinessAdmin', 'Manager'],
    'ORDER_DELETE': ['SUPER_ADMIN', 'BusinessAdmin'],
    
    // Inventory Management
    'INVENTORY_CREATE': ['SUPER_ADMIN', 'BusinessAdmin', 'Manager'],
    'INVENTORY_READ': ['SUPER_ADMIN', 'BusinessAdmin', 'Manager', 'Staff'],
    'INVENTORY_UPDATE': ['SUPER_ADMIN', 'BusinessAdmin', 'Manager'],
    'INVENTORY_DELETE': ['SUPER_ADMIN', 'BusinessAdmin'],
    
    // Reports
    'REPORTS_VIEW': ['SUPER_ADMIN', 'BusinessAdmin', 'Manager'],
    'REPORTS_EXPORT': ['SUPER_ADMIN', 'BusinessAdmin'],
    
    // System Administration
    'SYSTEM_ADMIN': ['SUPER_ADMIN'],
    'SYSTEM_CONFIG': ['SUPER_ADMIN']
};

/**
 * Check if user has required role
 */
const hasRole = (userRole, requiredRole) => {
    if (!userRole || !requiredRole) return false;
    
    // Direct role match
    if (userRole === requiredRole) return true;
    
    // Check role hierarchy (higher roles can access lower role permissions)
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
    
    return userLevel >= requiredLevel;
};

/**
 * Check if user has permission for specific action
 */
const hasPermission = (userRole, permission) => {
    if (!userRole || !permission) return false;
    
    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) return false;
    
    return allowedRoles.includes(userRole);
};

/**
 * Middleware to require specific role
 */
const requireRole = (requiredRole) => {
    return (req, res, next) => {
        const userRole = req.auth?.role;
        
        if (!userRole) {
            return next(createHttpError(401, "Authentication required"));
        }
        
        if (!hasRole(userRole, requiredRole)) {
            console.warn(`[RBAC] Access denied: User role ${userRole} insufficient for required role ${requiredRole}`);
            return next(createHttpError(403, `Access denied: ${requiredRole} role required`));
        }
        
        console.log(`[RBAC] Access granted: User ${req.auth.email} with role ${userRole} passed ${requiredRole} check`);
        next();
    };
};

/**
 * Middleware to require specific permission
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        const userRole = req.auth?.role;
        
        if (!userRole) {
            return next(createHttpError(401, "Authentication required"));
        }
        
        if (!hasPermission(userRole, permission)) {
            console.warn(`[RBAC] Access denied: User role ${userRole} lacks permission ${permission}`);
            return next(createHttpError(403, `Access denied: Insufficient permissions`));
        }
        
        console.log(`[RBAC] Access granted: User ${req.auth.email} with role ${userRole} has permission ${permission}`);
        next();
    };
};

/**
 * Middleware to require minimum role level
 */
const requireMinimumRole = (minimumRole) => {
    return (req, res, next) => {
        const userRole = req.auth?.role;
        
        if (!userRole) {
            return next(createHttpError(401, "Authentication required"));
        }
        
        if (!hasRole(userRole, minimumRole)) {
            console.warn(`[RBAC] Access denied: User role ${userRole} below minimum level ${minimumRole}`);
            return next(createHttpError(403, `Access denied: Minimum role ${minimumRole} required`));
        }
        
        console.log(`[RBAC] Access granted: User ${req.auth.email} with role ${userRole} meets minimum level ${minimumRole}`);
        next();
    };
};

/**
 * Middleware to check if user can access their own resource or has admin privileges
 */
const requireOwnershipOrAdmin = (resourceUserIdField = 'userId') => {
    return (req, res, next) => {
        const userRole = req.auth?.role;
        const currentUserId = req.auth?.id;
        const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField] || req.query[resourceUserIdField];
        
        if (!userRole) {
            return next(createHttpError(401, "Authentication required"));
        }
        
        // SuperAdmin can access everything
        if (userRole === 'SUPER_ADMIN') {
            console.log(`[RBAC] SuperAdmin access granted: ${req.auth.email}`);
            return next();
        }
        
        // BusinessAdmin can access resources within their business
        if (userRole === 'BusinessAdmin') {
            // Check if resource belongs to same business
            const resourceBusinessId = req.body.businessId || req.params.businessId;
            const userBusinessId = req.auth.businessId;
            
            if (resourceBusinessId && userBusinessId && resourceBusinessId === userBusinessId) {
                console.log(`[RBAC] BusinessAdmin access granted: ${req.auth.email} for business ${userBusinessId}`);
                return next();
            }
        }
        
        // Check ownership
        if (currentUserId && resourceUserId && currentUserId === resourceUserId) {
            console.log(`[RBAC] Owner access granted: ${req.auth.email} for their own resource`);
            return next();
        }
        
        console.warn(`[RBAC] Access denied: User ${req.auth.email} cannot access resource ${resourceUserId}`);
        return next(createHttpError(403, "Access denied: You can only access your own resources"));
    };
};

/**
 * Middleware for tenant-specific access control
 */
const requireTenantAccess = (req, res, next) => {
    const userRole = req.auth?.role;
    const panelType = req.auth?.panelType;
    
    if (!userRole) {
        return next(createHttpError(401, "Authentication required"));
    }
    
    // SuperAdmin can access everything
    if (userRole === 'SUPER_ADMIN') {
        console.log(`[RBAC] SuperAdmin tenant access granted: ${req.auth.email}`);
        return next();
    }
    
    // Tenant users must have TENANT panel type
    if (panelType !== 'TENANT') {
        console.warn(`[RBAC] Access denied: User ${req.auth.email} with panelType ${panelType} cannot access tenant routes`);
        return next(createHttpError(403, "Access denied: Tenant access required"));
    }
    
    // Additional tenant-specific validation can be added here
    console.log(`[RBAC] Tenant access granted: ${req.auth.email}`);
    next();
};

module.exports = {
    ROLE_HIERARCHY,
    PERMISSIONS,
    hasRole,
    hasPermission,
    requireRole,
    requirePermission,
    requireMinimumRole,
    requireOwnershipOrAdmin,
    requireTenantAccess
};
