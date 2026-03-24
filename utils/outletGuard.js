const createHttpError = require('http-errors');

/**
 * 🚨 STRICT OUTLET ISOLATION GUARD
 * 
 * CRITICAL: This function MUST be called at the start of every controller
 * that accesses outlet-scoped data. It prevents cross-outlet data leakage.
 * 
 * RULES:
 * - All outlet-scoped queries MUST include outletId
 * - No conditional outlet filtering (if outletId)
 * - SuperAdmins can bypass for cross-outlet operations
 * - HeadOffice role can access all outlets within tenant
 * - OutletAdmin/Staff MUST have specific outletId
 */
function enforceOutletScope(req, options = {}) {
    const { 
        allowHeadOffice = true,  // HeadOffice can access all outlets
        allowSuperAdmin = true,  // SuperAdmin can bypass
        requireExplicitOutlet = false  // Require outlet even for HeadOffice
    } = options;

    const userRole = req.userRole || req.user?.role || req.auth?.role;
    const outletId = req.outletId || req.auth?.outletId;
    const isSuperAdmin = req.isSuperAdmin || userRole === 'SUPER_ADMIN';
    const isHeadOffice = userRole === 'HEAD_OFFICE' || userRole === 'BUSINESS_OWNER' || userRole === 'BusinessAdmin';
    const isOutletAdmin = userRole === 'OUTLET_ADMIN' || userRole === 'OUTLET_MANAGER';
    const isOutletStaff = userRole === 'OUTLET_STAFF' || userRole === 'STAFF' || userRole === 'CASHIER';

    // 1. SuperAdmin bypass (if allowed)
    if (isSuperAdmin && allowSuperAdmin) {
        console.log('🔓 SuperAdmin bypass - outlet scope not enforced');
        return { 
            enforced: false, 
            reason: 'super_admin_bypass',
            outletId: outletId || null,
            scope: 'unrestricted'
        };
    }

    // 2. HeadOffice can access all outlets (if allowed)
    if (isHeadOffice && allowHeadOffice && !requireExplicitOutlet) {
        if (!outletId) {
            console.log('🏢 HeadOffice access - all outlets within tenant');
            return {
                enforced: true,
                reason: 'head_office_all_outlets',
                outletId: null,  // Null means all outlets
                scope: 'tenant_wide'
            };
        }
        console.log(`🏢 HeadOffice access - specific outlet: ${outletId}`);
        return {
            enforced: true,
            reason: 'head_office_specific_outlet',
            outletId: outletId,
            scope: 'outlet_specific'
        };
    }

    // 3. Outlet-specific roles MUST have outletId
    if (isOutletAdmin || isOutletStaff) {
        if (!outletId) {
            console.error('🚨 SECURITY VIOLATION: Outlet role without outletId', {
                role: userRole,
                userId: req.auth?.id,
                path: req.path
            });
            throw createHttpError(403, '🚨 Access denied: Outlet ID required for your role');
        }

        console.log(`✅ Outlet access granted: ${outletId} for role: ${userRole}`);
        return {
            enforced: true,
            reason: 'outlet_role_explicit',
            outletId: outletId,
            scope: 'outlet_specific',
            role: userRole
        };
    }

    // 4. Default: Require outletId for all non-admin users
    if (!outletId) {
        console.error('🚨 SECURITY VIOLATION: Missing outletId', {
            role: userRole,
            userId: req.auth?.id,
            path: req.path
        });
        throw createHttpError(403, '🚨 Access denied: Outlet ID required');
    }

    return {
        enforced: true,
        reason: 'default_outlet_required',
        outletId: outletId,
        scope: 'outlet_specific'
    };
}

/**
 * Build strict WHERE clause with MANDATORY outlet filtering
 * 
 * ❌ NO CONDITIONAL LOGIC - outletId is ALWAYS included
 * ✅ ALWAYS includes businessId + outletId
 */
function buildStrictWhereClause(req, baseFilters = {}) {
    const outletCheck = enforceOutletScope(req);
    
    // Build strict where clause
    const whereClause = {
        businessId: req.businessId,
        ...baseFilters
    };

    // For outlet-specific scope, ALWAYS include outletId (NO CONDITIONS!)
    if (outletCheck.scope === 'outlet_specific' && outletCheck.outletId) {
        whereClause.outletId = outletCheck.outletId;
    }

    // HeadOffice with tenant_wide scope does NOT add outlet filter
    // This allows them to see all outlets but still within their tenant

    return {
        whereClause,
        scope: outletCheck.scope,
        outletId: outletCheck.outletId
    };
}

/**
 * Middleware to enforce outlet scope on routes
 */
function outletScopeMiddleware(options = {}) {
    return (req, res, next) => {
        try {
            const result = enforceOutletScope(req, options);
            
            // Attach scope info to request for controllers
            req.outletScope = result;
            
            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Validate outlet access for specific outletId parameter
 * Prevents users from accessing other outlets by manipulating URL params
 */
function validateOutletAccess(req, targetOutletId) {
    const userOutletId = req.outletId || req.auth?.outletId;
    const userRole = req.auth?.role || req.userRole;
    const isSuperAdmin = req.isSuperAdmin || userRole === 'SUPER_ADMIN';
    const isHeadOffice = userRole === 'HEAD_OFFICE' || userRole === 'BUSINESS_OWNER' || userRole === 'BusinessAdmin';

    // SuperAdmin and HeadOffice can access any outlet in their tenant
    if (isSuperAdmin || isHeadOffice) {
        return { allowed: true, reason: 'admin_access' };
    }

    // Outlet-specific users can only access their assigned outlet
    if (userOutletId !== targetOutletId) {
        console.error('🚨 OUTLET ACCESS VIOLATION', {
            userOutletId,
            targetOutletId,
            userId: req.auth?.id,
            role: userRole
        });
        return { 
            allowed: false, 
            reason: 'outlet_mismatch',
            message: '🚨 Access denied: Cannot access data from other outlets'
        };
    }

    return { allowed: true, reason: 'outlet_match' };
}

module.exports = {
    enforceOutletScope,
    buildStrictWhereClause,
    outletScopeMiddleware,
    validateOutletAccess
};
