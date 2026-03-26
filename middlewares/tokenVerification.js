const createHttpError = require("http-errors");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const { controlPlaneSequelize } = require("../config/control_plane_db");
const tokenBlacklist = require("../utils/inMemoryTokenBlacklist");
// OPTIMIZATION: Direct model import for fast auth queries (no executor overhead)
const { sequelize } = require('../config/unified_database');
const { ModelFactory } = require('../src/architecture/modelFactory');
const { PUBLIC_SCHEMA } = require('../src/utils/constants');

// Cache for user lookups to reduce DB calls
const userCache = new Map();
const USER_CACHE_TTL = 30 * 1000; // 30 seconds

const isVerifiedUser = async (req, res, next) => {
    const verifyStartTime = Date.now();
    
    try {
        let token = req.cookies?.accessToken;

        if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return next(createHttpError(401, "Please provide token!"));
        }

        // Strict JWT verification with issuer, audience, and tokenVersion
        const decodeToken = jwt.verify(token, config.accessTokenSecret, {
            issuer: 'brewwlabs-pos',
            audience: 'brewwlabs-pos-users',
            clockTolerance: 30 // 30 seconds clock skew tolerance
        });
        
        req.auth = decodeToken;

        const userId = decodeToken.id || decodeToken.userId || decodeToken._id;
        if (!userId) {
            return next(createHttpError(401, "Invalid token: Missing user identifier"));
        }

        // Check if token is blacklisted (in-memory logout tracking)
        const blacklisted = await tokenBlacklist.isTokenBlacklisted(token, decodeToken.jti);
        if (blacklisted) {
            return next(createHttpError(401, "Token has been revoked"));
        }

        let user = null;

        // ---- SuperAdmin Case ----
        if (decodeToken.role === 'SUPER_ADMIN') {
            try {
                const [userResult] = await controlPlaneSequelize.query(`
                    SELECT id, email, role, "token_version" as "tokenVersion"
                    FROM super_admin_users 
                    WHERE id = :userId
                `, { replacements: { userId } });
                
                if (userResult.length > 0) {
                    user = userResult[0];
                    // Validate tokenVersion for session invalidation
                    if (user.tokenVersion !== decodeToken.tokenVersion) {
                        return next(createHttpError(401, "Token version mismatch - session invalidated"));
                    }
                }
            } catch (dbError) {
                return next(createHttpError(500, "Authentication validation failed"));
            }
        } 
        // ---- Tenant User Case ----
        else {
            if (!req.path.includes('/logout')) {
                const businessId = decodeToken.businessId;
                if (!businessId) {
                    return next(createHttpError(401, "Invalid token: Missing tenant identifier"));
                }

                try {
                    // CRITICAL: Force public schema for control plane queries
                    await sequelize.query(`SET search_path TO "${PUBLIC_SCHEMA}"`);
                    
                    // OPTIMIZATION: Use direct model queries without executor overhead
                    // Ensure models are initialized on the global instance
                    const models = await ModelFactory.createModels(sequelize);
                    const { User, TenantRegistry, Business } = models;
                    
                    // Check cache first
                    const cacheKey = `${userId}:${businessId}`;
                    const cached = userCache.get(cacheKey);
                    if (cached && (Date.now() - cached.timestamp < USER_CACHE_TTL)) {
                        user = cached.data.user;
                        req.tenant = cached.data.tenant;
                        // Still validate token version even from cache
                        if (user.token_version !== decodeToken.tokenVersion) {
                            return next(createHttpError(401, "Token version mismatch - session invalidated"));
                        }
                        if (!user.is_active) {
                            return next(createHttpError(403, "User account is disabled"));
                        }
                    } else {
                        // Parallel query for tenant registry, user, AND business (ALL-IN-ONE)
                        // models are already available in scope from above
                        
                        const [tenantRegistry, dbUser, dbBusiness] = await Promise.all([
                            TenantRegistry.findOne({
                                where: { businessId },
                                attributes: ['status']
                            }),
                            User.findByPk(userId, {
                                attributes: ['id', 'email', 'role', 'token_version', 'business_id', 'outlet_id', 'panel_type', 'is_active']
                            }),
                            Business.findByPk(businessId, {
                                attributes: ['id', 'name', 'status', 'isActive', 'type']
                            })
                        ]);
                        
                        // CRITICAL: Check tenant status BEFORE allowing auth
                        // Allow both 'active' and 'onboarding' - onboarding means schema is being initialized
                        const allowedStatuses = ['active', 'onboarding'];
                        if (!tenantRegistry || !allowedStatuses.includes(tenantRegistry.status)) {
                            return next(createHttpError(503, 'Tenant not ready, please retry'));
                        }
                        
                        if (!dbBusiness || dbBusiness.status === 'SUSPENDED' || dbBusiness.isActive === false) {
                            return next(createHttpError(403, 'Tenant is suspended or inactive'));
                        }

                        if (!dbUser) {
                            return next(createHttpError(401, "User not found"));
                        }
                        
                        user = dbUser.get ? dbUser.get({ plain: true }) : dbUser;
                        const tenant = dbBusiness.get ? dbBusiness.get({ plain: true }) : dbBusiness;
                        
                        // Validate token version
                        if (user.token_version !== decodeToken.tokenVersion) {
                            return next(createHttpError(401, "Token version mismatch - session invalidated"));
                        }
                        
                        // Check if user is active
                        if (!user.is_active) {
                            return next(createHttpError(403, "User account is disabled"));
                        }
                        
                        // Cache the aggregated data
                        userCache.set(cacheKey, { 
                            data: { user, tenant }, 
                            timestamp: Date.now() 
                        });
                        req.tenant = tenant;
                    }
                } catch (dbError) {
                    console.error('🔍 Auth DB Error:', dbError.message);
                    return next(createHttpError(503, 'Authentication service unavailable'));
                }
            }
        }

        if (!user && !req.path.includes('/logout')) {
            res.clearCookie("accessToken");
            return next(createHttpError(401, "User does not exist!"));
        }

        // Attach context to request
        const plainUser = user && typeof user.get === 'function' ? user.get({ plain: true }) : user;
        req.user = plainUser;
        req.userRole = decodeToken.role;
        
        // CRITICAL FIX: Only use JWT values if they exist, don't override with null/undefined
        req.auth = {
            ...req.auth,
            ...(decodeToken.businessId && { businessId: decodeToken.businessId }),
            ...(decodeToken.outletId && { outletId: decodeToken.outletId }),
            ...(decodeToken.brandId && { brandId: decodeToken.brandId })
        };
        
        // Strict Outlet Isolation Hardening
        req.businessId = req.auth.businessId;
        req.outletId = req.auth.outletId;
        
        // Validate strictly - missing outletId immediately invalidates token context for outlet staff
        const currentRole = decodeToken.role;
        if (!req.outletId && currentRole !== 'SUPER_ADMIN' && currentRole !== 'BusinessAdmin') {
            return next(createHttpError(403, "🚨 Access Denied: outletId missing in token. Strict outlet isolation enforced."));
        }
        
        // Final fallback for panelType
        if (!req.auth.panelType) {
            req.auth.panelType = decodeToken.role === 'SUPER_ADMIN' ? 'ADMIN' : 'TENANT';
        }

        // OPTIMIZATION: Non-blocking audit logging (fire-and-forget)
        const { logAuthEvent } = require('../security/auditLogger');
        const verifyDuration = Date.now() - verifyStartTime;
        
        // Fire-and-forget logging (don't await)
        logAuthEvent({
            userId,
            email: plainUser?.email || decodeToken.email,
            role: decodeToken.role,
            action: 'TOKEN_VERIFIED',
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            duration: verifyDuration
        }).catch(() => {}); // Silent fail

        next();

    } catch (error) {
        // Enhanced error handling for security
        if (error.name === 'JsonWebTokenError') {
            error = createHttpError(401, "Invalid token format");
        } else if (error.name === 'TokenExpiredError') {
            error = createHttpError(401, "Token expired");
        } else if (error.name === 'NotBeforeError') {
            error = createHttpError(401, "Token not active");
        }
        
        res.clearCookie("accessToken");
        
        // Log failed authentication attempt
        const { logAuthEvent } = require('../security/auditLogger');
        try {
            await logAuthEvent({
                action: 'TOKEN_VERIFICATION_FAILED',
                error: error.message,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                path: req.path
            });
        } catch (logError) {
                // Silent fail - don't break auth if logging fails
            }
        
        next(error);
    }
}

const adminOnlyMiddleware = (req, res, next) => {
    if (req.auth?.role !== 'SUPER_ADMIN' || req.auth?.panelType !== 'ADMIN') {
        return next(createHttpError(403, "Access denied: Admin access required"));
    }
    next();
};

const tenantOnlyMiddleware = (req, res, next) => {
    if (req.auth?.role === 'SUPER_ADMIN') {
        return next(createHttpError(403, "Access denied: Tenant routes require TENANT panel type"));
    }
    if (req.auth?.panelType !== 'TENANT') {
        return next(createHttpError(403, "Access denied: Tenant routes require TENANT panel type"));
    }
    next();
};

module.exports = { 
    isVerifiedUser, 
    adminOnlyMiddleware, 
    tenantOnlyMiddleware 
};