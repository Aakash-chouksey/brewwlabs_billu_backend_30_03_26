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
                const business_id = decodeToken.business_id || decodeToken.businessId;
                if (!business_id) {
                    return next(createHttpError(401, "Invalid token: Missing tenant identifier"));
                }

                try {
                    // OPTIMIZATION: Use neonTransactionSafeExecutor for transaction-scoped queries
                    const neonTransactionSafeExecutor = require('../services/neonTransactionSafeExecutor');
                    
                    // Define cache key before the callback so it's accessible after
                    const cacheKey = `${userId}:${business_id}`;
                    
                    // Check cache first before making DB calls
                    const cached = userCache.get(cacheKey);
                    if (cached && (Date.now() - cached.timestamp < USER_CACHE_TTL)) {
                        const { user: cachedUser, tenant: cachedTenant } = cached.data;
                        user = cachedUser;
                        req.tenant = cachedTenant;
                        console.log(`🔒 [Auth/Verify] Cache hit for user: ${userId}`);
                    } else {
                        // Cache miss - fetch from database
                        const authResult = await neonTransactionSafeExecutor.executeInPublic(async ({ models }) => {
                            const { User, TenantRegistry, Business } = models;
                            
                            // DEBUG: Log all TenantRegistry attributes for troubleshooting
                            const rawAttrs = TenantRegistry?.rawAttributes || {};
                            const attrNames = Object.keys(rawAttrs);
                            console.log('🔍 [AUTH DEBUG] TenantRegistry rawAttributes:', attrNames.join(', '));
                            
                            // Check for businessId (camelCase attribute name)
                            if (rawAttrs.businessId) {
                                console.log('✅ [AUTH DEBUG] businessId attribute found');
                                console.log('   - field mapping:', rawAttrs.businessId.field);
                                console.log('   - type:', rawAttrs.businessId.type?.key || 'unknown');
                            } else {
                                console.error('❌ [AUTH DEBUG] businessId attribute MISSING in TenantRegistry');
                                console.error('   Available attributes:', attrNames);
                            }
                            
                            // Also check for other critical fields
                            const criticalFields = ['id', 'schemaName', 'status', 'createdAt'];
                            const missingFields = criticalFields.filter(f => !rawAttrs[f]);
                            if (missingFields.length > 0) {
                                console.warn('⚠️ [AUTH DEBUG] Missing critical fields:', missingFields);
                            }
                            
                            // Parallel query for tenant registry, user, AND business (ALL-IN-ONE)
                            const [tenantRegistry, dbUser, dbBusiness] = await Promise.all([
                                TenantRegistry.findOne({
                                    where: { businessId: business_id },
                                    attributes: ['status']
                                }),
                                User.findByPk(userId, {
                                    attributes: ['id', 'email', 'name', 'role', 'tokenVersion', 'businessId', 'outletId', 'panelType', 'isActive']
                                }),
                                Business.findByPk(business_id, {
                                    attributes: ['id', 'name', 'status', 'isActive', 'type']
                                })
                            ]);
                            
                            return { tenantRegistry, dbUser, dbBusiness };
                        });
                        
                        const { tenantRegistry, dbUser, dbBusiness } = authResult.data;
                            
                        // CRITICAL: Check tenant status BEFORE allowing auth with detailed error messages
                        const status = (tenantRegistry?.status || '').toUpperCase();
                        
                        console.log(`🔒 [Auth/Verify] Tenant: ${business_id} | Status: ${status}`);

                        // Handle specific statuses with meaningful errors
                        if (!tenantRegistry) {
                            console.warn(`🚫 [Auth/Verify] Tenant not found in registry: ${business_id}`);
                            return next(createHttpError(404, 'Tenant not found. The business ID provided does not exist in our registry.'));
                        }
                        
                        if (status === 'INIT_FAILED') {
                            console.warn(`🚫 [Auth/Verify] Tenant setup failed: ${business_id}`);
                            return next(createHttpError(403, 'Tenant initialization failed. The database schema could not be created correctly. Please contact support.'));
                        }
                        
                        if (status === 'INIT_IN_PROGRESS' || status === 'CREATING' || status === 'PROVISIONING') {
                            console.warn(`⏳ [Auth/Verify] Tenant still initializing: ${business_id}`);
                            return next(createHttpError(503, 'Tenant not initialized. The system is currently setting up your workspace. Please try again in a few seconds.'));
                        }
                        
                        if (status === 'SUSPENDED' || status === 'INACTIVE' || status === 'DEACTIVATED') {
                            console.warn(`🚫 [Auth/Verify] Tenant suspended: ${business_id}`);
                            return next(createHttpError(403, 'Tenant account is currently suspended or inactive. Please contact support to resolve this.'));
                        }
                        
                        // Allowed statuses for normal operation
                        const allowedStatuses = ['ACTIVE', 'READY'];
                        if (!allowedStatuses.includes(status)) {
                            console.warn(`🚫 [Auth/Verify] Tenant blocked. Registry status: ${status}`);
                            return next(createHttpError(403, `Tenant not ready for access (Current status: ${status}).`));
                        }
                        
                        if (!dbBusiness || dbBusiness.status === 'SUSPENDED' || dbBusiness.isActive === false) {
                            return next(createHttpError(403, 'The business account is suspended or inactive.'));
                        }

                        if (!dbUser) {
                            return next(createHttpError(401, "Authenticated user not found in this tenant context."));
                        }
                        
                        user = dbUser.get ? dbUser.get({ plain: true }) : dbUser;
                        const tenant = dbBusiness.get ? dbBusiness.get({ plain: true }) : dbBusiness;
                        
                        // Validate token version
                        if (user.tokenVersion !== decodeToken.tokenVersion) {
                            return next(createHttpError(401, "Session has expired or been invalidated. Please log in again."));
                        }
                        
                        // Check if user is active
                        if (!user.isActive) {
                            return next(createHttpError(403, "Your user account has been disabled."));
                        }
                        
                        // Cache the aggregated data
                        userCache.set(cacheKey, { 
                            data: { user, tenant }, 
                            timestamp: Date.now() 
                        });
                        req.tenant = tenant;
                    }
                    
                } catch (dbError) {
                    console.error('🔍 [Auth/Verify] DB Error:', dbError.message);
                    
                    // More specific error message for database connection issues
                    if (dbError.message?.includes('does not exist') || dbError.message?.includes('not found')) {
                        return next(createHttpError(404, 'Tenant database schema not found. Provisioning may be incomplete.'));
                    }
                    if (dbError.message?.includes('ECONNREFUSED') || dbError.message?.includes('timeout')) {
                        return next(createHttpError(503, 'Database connection temporary failure. Please try again.'));
                    }
                    return next(createHttpError(503, 'Authentication service temporarily unavailable due to system overhead.'));
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
        
        // CRITICAL FIX: Standardize on snake_case (business_id, outlet_id)
        req.auth = {
            ...req.auth,
            business_id: decodeToken.business_id || decodeToken.businessId,
            outlet_id: decodeToken.outlet_id || decodeToken.outletId,
            brand_id: decodeToken.brand_id || decodeToken.brandId
        };
        
        // Strict Outlet Isolation Hardening
        req.business_id = req.auth.business_id;
        req.businessId = req.auth.business_id; // Legacy support
        req.outlet_id = req.auth.outlet_id;
        req.outletId = req.auth.outlet_id; // Legacy support
        
        // Validate strictly - missing outlet_id immediately invalidates token context for outlet staff
        const currentRole = decodeToken.role;
        if (!req.outlet_id && currentRole !== 'SUPER_ADMIN' && currentRole !== 'BusinessAdmin') {
            return next(createHttpError(403, "🚨 Access Denied: outlet_id missing in token. Strict outlet isolation enforced."));
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