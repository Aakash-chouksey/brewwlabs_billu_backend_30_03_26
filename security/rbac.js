const createHttpError = require('http-errors');
const { logSecurityViolation } = require('../security/auditLogger');

/**
 * Role-Based Access Control (RBAC) System
 * Enforces strict role hierarchy and resource-level permissions
 */
class RBACSystem {
    constructor() {
        // Role hierarchy - higher number = more privileges
        this.roleHierarchy = {
            'SUPER_ADMIN': 100,
            'DISTRIBUTOR_ADMIN': 90,
            'BRAND_ADMIN': 80,
            'BUSINESS_ADMIN': 70,
            'OUTLET_MANAGER': 60,
            'MANAGER': 50,
            'CASHIER': 40,
            'WAITER': 30,
            'EMPLOYEE': 20
        };

        // Resource permissions
        this.resourcePermissions = {
            // User Management
            'users': {
                'SUPER_ADMIN': ['create', 'read', 'update', 'delete', 'manage_roles'],
                'DISTRIBUTOR_ADMIN': ['create', 'read', 'update', 'delete'],
                'BRAND_ADMIN': ['create', 'read', 'update'],
                'BUSINESS_ADMIN': ['create', 'read', 'update'],
                'OUTLET_MANAGER': ['read', 'update'],
                'MANAGER': ['read'],
                'CASHIER': ['read'],
                'WAITER': ['read']
            },
            
            // Order Management
            'orders': {
                'SUPER_ADMIN': ['create', 'read', 'update', 'delete', 'view_all'],
                'DISTRIBUTOR_ADMIN': ['create', 'read', 'update', 'delete', 'view_brand'],
                'BRAND_ADMIN': ['create', 'read', 'update', 'delete', 'view_brand'],
                'BUSINESS_ADMIN': ['create', 'read', 'update', 'delete', 'view_brand'],
                'OUTLET_MANAGER': ['create', 'read', 'update', 'delete', 'view_outlet'],
                'MANAGER': ['create', 'read', 'update', 'view_outlet'],
                'CASHIER': ['create', 'read', 'update'],
                'WAITER': ['create', 'read']
            },

            // Inventory Management
            'inventory': {
                'SUPER_ADMIN': ['create', 'read', 'update', 'delete', 'manage_stock'],
                'DISTRIBUTOR_ADMIN': ['create', 'read', 'update', 'delete', 'manage_stock'],
                'BRAND_ADMIN': ['create', 'read', 'update', 'delete', 'manage_stock'],
                'BUSINESS_ADMIN': ['create', 'read', 'update', 'manage_stock'],
                'OUTLET_MANAGER': ['create', 'read', 'update', 'manage_stock'],
                'MANAGER': ['read', 'update'],
                'CASHIER': ['read'],
                'WAITER': ['read']
            },

            // Reports and Analytics
            'reports': {
                'SUPER_ADMIN': ['read', 'export', 'view_all'],
                'DISTRIBUTOR_ADMIN': ['read', 'export', 'view_brand'],
                'BRAND_ADMIN': ['read', 'export', 'view_brand'],
                'BUSINESS_ADMIN': ['read', 'export', 'view_brand'],
                'OUTLET_MANAGER': ['read', 'view_outlet'],
                'MANAGER': ['read', 'view_outlet'],
                'CASHIER': ['read'],
                'WAITER': ['read']
            },

            // System Settings
            'settings': {
                'SUPER_ADMIN': ['read', 'update', 'manage'],
                'DISTRIBUTOR_ADMIN': ['read'],
                'BRAND_ADMIN': ['read'],
                'BUSINESS_ADMIN': ['read'],
                'OUTLET_MANAGER': ['read'],
                'MANAGER': ['read'],
                'CASHIER': [],
                'WAITER': []
            },

            // Financial Data
            'financial': {
                'SUPER_ADMIN': ['read', 'export', 'view_all'],
                'DISTRIBUTOR_ADMIN': ['read', 'export', 'view_brand'],
                'BRAND_ADMIN': ['read', 'export', 'view_brand'],
                'BUSINESS_ADMIN': ['read', 'export', 'view_brand'],
                'OUTLET_MANAGER': ['read', 'view_outlet'],
                'MANAGER': ['read'],
                'CASHIER': [],
                'WAITER': []
            }
        };
    }

    /**
     * Check if user has sufficient role level
     */
    hasMinimumRole(userRole, requiredRole) {
        const normalizedUserRole = this.normalizeRole(userRole);
        const normalizedRequiredRole = this.normalizeRole(requiredRole);
        const userLevel = this.roleHierarchy[normalizedUserRole] || 0;
        const requiredLevel = this.roleHierarchy[normalizedRequiredRole] || 999;
        return userLevel >= requiredLevel;
    }

    /**
     * Normalize role name to consistent format
     */
    normalizeRole(role) {
        if (!role) return role;
        
        // Convert various role formats to standard RBAC format
        const roleMap = {
            'ADMIN': 'BUSINESS_ADMIN',
            'BusinessAdmin': 'BUSINESS_ADMIN',
            'businessAdmin': 'BUSINESS_ADMIN',
            'business_admin': 'BUSINESS_ADMIN',
            'BrandAdmin': 'BRAND_ADMIN',
            'brandAdmin': 'BRAND_ADMIN',
            'brand_admin': 'BRAND_ADMIN',
            'OutletManager': 'OUTLET_MANAGER',
            'outletManager': 'OUTLET_MANAGER',
            'outlet_manager': 'OUTLET_MANAGER',
            'SuperAdmin': 'SUPER_ADMIN',
            'superAdmin': 'SUPER_ADMIN',
            'super_admin': 'SUPER_ADMIN',
            'DistributorAdmin': 'DISTRIBUTOR_ADMIN',
            'distributorAdmin': 'DISTRIBUTOR_ADMIN',
            'distributor_admin': 'DISTRIBUTOR_ADMIN',
            'Manager': 'MANAGER',
            'manager': 'MANAGER',
            'Cashier': 'CASHIER',
            'cashier': 'CASHIER',
            'Waiter': 'WAITER',
            'waiter': 'WAITER',
            'Employee': 'EMPLOYEE',
            'employee': 'EMPLOYEE'
        };
        
        return roleMap[role] || role;
    }

    /**
     * Check if user has permission for specific action on resource
     */
    hasPermission(userRole, resource, action) {
        const normalizedRole = this.normalizeRole(userRole);
        const rolePermissions = this.resourcePermissions[resource] || {};
        const permissions = rolePermissions[normalizedRole] || [];
        return permissions.includes(action);
    }

    /**
     * Check tenant ownership/access rights
     */
    canAccessTenantData(user, targetBusinessId, targetOutletId = null) {
        const { role, businessId, outletId } = user;
        const normalizedRole = this.normalizeRole(role);

        // SuperAdmin can access any tenant
        if (normalizedRole === 'SUPER_ADMIN') {
            return true;
        }

        // Check business access
        if (businessId !== targetBusinessId) {
            return false;
        }

        // Check outlet access if specified
        if (targetOutletId && outletId && outletId !== targetOutletId) {
            // Only allow outlet-level access for roles that can manage multiple outlets
            const canManageMultipleOutlets = ['BRAND_ADMIN', 'BUSINESS_ADMIN'].includes(normalizedRole);
            if (!canManageMultipleOutlets) {
                return false;
            }
        }

        return true;
    }

    /**
     * Generate authorization middleware
     */
    authorize(options = {}) {
        return async (req, res, next) => {
            try {
                const {
                    resource,
                    action,
                    requireRole = null,
                    requireOwnership = false,
                    allowCrossTenant = false
                } = options;

                const user = req.auth || {};
                const userRole = user.role;

                if (!userRole) {
                    return next(createHttpError(401, 'Authentication required'));
                }

                // Check minimum role requirement
                if (requireRole && !this.hasMinimumRole(userRole, requireRole)) {
                    await this._logUnauthorizedAccess(req, 'INSUFFICIENT_ROLE', {
                        required: requireRole,
                        current: userRole
                    });
                    return next(createHttpError(403, `Access denied: ${requireRole} role required`));
                }

                // Check resource permission
                if (resource && action && !this.hasPermission(userRole, resource, action)) {
                    await this._logUnauthorizedAccess(req, 'INSUFFICIENT_PERMISSION', {
                        resource,
                        action,
                        role: userRole
                    });
                    return next(createHttpError(403, `Access denied: Cannot ${action} ${resource}`));
                }

                // Check tenant access
                if (!allowCrossTenant && req.businessId) {
                    const canAccess = this.canAccessTenantData(
                        user,
                        req.businessId,
                        req.outletId
                    );

                    if (!canAccess) {
                        await this._logUnauthorizedAccess(req, 'TENANT_ACCESS_DENIED', {
                            userBusinessId: user.businessId,
                            targetBusinessId: req.businessId,
                            userOutletId: user.outletId,
                            targetOutletId: req.outletId
                        });
                        return next(createHttpError(403, 'Access denied: Cannot access this tenant data'));
                    }
                }

                // Check resource ownership if required
                if (requireOwnership) {
                    const hasOwnership = await this._checkResourceOwnership(req, user);
                    if (!hasOwnership) {
                        await this._logUnauthorizedAccess(req, 'OWNERSHIP_REQUIRED', {
                            userId: user.id,
                            resource: req.params.id || 'unknown'
                        });
                        return next(createHttpError(403, 'Access denied: Resource ownership required'));
                    }
                }

                next();

            } catch (error) {
                console.error('RBAC authorization error:', error);
                next(createHttpError(500, 'Authorization check failed'));
            }
        };
    }

    /**
     * Check if user owns the resource
     */
    async _checkResourceOwnership(req, user) {
        try {
            const resourceId = req.params.id;
            const resourceType = req.route.path.split('/')[1]; // Extract resource type from path
            const normalizedRole = this.normalizeRole(user.role);

            if (!resourceId || !req.models) {
                return false;
            }

            // Different ownership rules based on resource type
            switch (resourceType) {
                case 'orders':
                    const order = await req.models.Order.findByPk(resourceId);
                    return order && (
                        order.createdBy === user.id || 
                        normalizedRole === 'OUTLET_MANAGER' ||
                        this.hasMinimumRole(normalizedRole, 'BUSINESS_ADMIN')
                    );

                case 'users':
                    // Users can only access their own profile unless they're admin
                    return resourceId === user.id || 
                           this.hasMinimumRole(normalizedRole, 'OUTLET_MANAGER');

                default:
                    // For other resources, check if user belongs to same tenant
                    return this.canAccessTenantData(user, req.businessId, req.outletId);
            }

        } catch (error) {
            console.error('Ownership check failed:', error);
            return false;
        }
    }

    /**
     * Log unauthorized access attempts
     */
    async _logUnauthorizedAccess(req, reason, details) {
        try {
            await logSecurityViolation({
                userId: req.auth?.id,
                email: req.auth?.email,
                action: 'UNAUTHORIZED_ACCESS',
                violation: reason,
                severity: 'HIGH',
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                path: req.path,
                details: {
                    ...details,
                    method: req.method,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Failed to log unauthorized access:', error);
        }
    }

    /**
     * Get user permissions for frontend
     */
    getUserPermissions(userRole) {
        const permissions = {};
        
        Object.keys(this.resourcePermissions).forEach(resource => {
            permissions[resource] = this.resourcePermissions[resource][userRole] || [];
        });

        return permissions;
    }
}

// Export singleton instance
const rbac = new RBACSystem();

// Convenience middleware creators
module.exports = {
    // Require specific role
    requireRole: (role) => rbac.authorize({ requireRole: role }),
    
    // Require permission for resource
    requirePermission: (resource, action) => rbac.authorize({ resource, action }),
    
    // Require both role and permission
    requireRoleAndPermission: (role, resource, action) => 
        rbac.authorize({ requireRole: role, resource, action }),
    
    // Allow cross-tenant access (for SuperAdmin)
    allowCrossTenant: (resource, action) => 
        rbac.authorize({ resource, action, allowCrossTenant: true }),
    
    // Require resource ownership
    requireOwnership: (resource, action) => 
        rbac.authorize({ resource, action, requireOwnership: true }),
    
    // Raw RBAC instance for advanced usage
    rbac
};
