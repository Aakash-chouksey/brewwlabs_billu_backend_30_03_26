const { neonSafeTenantMiddleware, neonSafeModelInjection } = require('../../middlewares/neonSafeTenantMiddleware');
const tenantStatusMiddleware = require('../../middlewares/tenantStatusMiddleware');
const { globalErrorHandler } = require('../../middlewares/globalErrorHandlers');
const { connectUnifiedDB } = require('../../config/unified_database');
const neonTransactionSafeExecutor = require('../../services/neonTransactionSafeExecutor');

/**
 * NEON-SAFE MIDDLEWARE CHAIN
 * 
 * Replaces unsafe middleware with Neon-transaction-safe alternatives
 * ENFORCES: Zero cross-tenant leakage, all operations transaction-scoped
 */

/**
 * NEON-SAFE ADMIN MIDDLEWARE CHAIN
 * For SuperAdmin routes using control plane database
 */
const neonSafeAdminMiddlewareChain = [
    // 1. Request safety
    require('../../middlewares/globalErrorHandlers').requestTimeoutMiddleware(30000),
    require('../../middlewares/globalErrorHandlers').responseValidationMiddleware,
    // REMOVED: hangingRequestDetector - adds overhead without value
    
    // 2. Authentication
    require('../../middlewares/tokenVerification').isVerifiedUser,
    
    // 3. Role enforcement
    require('../../middlewares/tokenVerification').adminOnlyMiddleware
];

/**
 * NEON-SAFE TENANT MIDDLEWARE CHAIN
 * For tenant routes using transaction-safe schema operations
 */
const neonSafeTenantMiddlewareChain = [
    // 1. Request safety
    require('../../middlewares/globalErrorHandlers').requestTimeoutMiddleware(30000),
    require('../../middlewares/globalErrorHandlers').responseValidationMiddleware,
    // REMOVED: hangingRequestDetector - adds overhead without value
    
    // 2. Authentication
    require('../../middlewares/tokenVerification').isVerifiedUser,
    
    // 3. Neon-safe tenant resolution (NO GLOBAL SCHEMA SWITCHING)
    neonSafeTenantMiddleware,
    
    // 4. Neon-safe model injection (TRANSACTION-ONLY METHODS)
    neonSafeModelInjection,
    
    // 5. Tenant Status Enforcement (Fix 3)
    tenantStatusMiddleware,
    
    // 6. Tenant-only enforcement
    require('../../middlewares/tokenVerification').tenantOnlyMiddleware
];

/**
 * NEON-SAFE PUBLIC MIDDLEWARE CHAIN
 * For unauthenticated routes
 */
const neonSafePublicMiddlewareChain = [
    // 0. Cookie parsing
    require('cookie-parser')(),
    
    // 1. Request safety
    require('../../middlewares/globalErrorHandlers').requestTimeoutMiddleware(120000), // Increased for onboarding/registration
    require('../../middlewares/globalErrorHandlers').responseValidationMiddleware
    // REMOVED: hangingRequestDetector - adds overhead without value
];

const path = require('path');

/**
 * Apply Neon-safe middleware chains to routes
 */
const applyNeonSafeMiddlewareChains = (app) => {
    console.log('🔐 Applying Neon-safe middleware chains...');

    // Initialize transaction executor health check (Async, non-blocking for route registration)
    neonTransactionSafeExecutor.healthCheck()
        .then(healthCheck => {
            if (healthCheck.healthy) {
                console.log('✅ Neon transaction executor is healthy');
            } else {
                console.error('❌ Neon transaction executor health check failed:', healthCheck.message);
            }
        })
        .catch(error => {
            console.error('❌ Failed to initialize transaction executor:', error.message);
        });

    // Helper to get absolute path
    const getRoutePath = (relativePath) => {
        // If it starts with 'src/', leave it as is, otherwise it's relative to project root
        const fullPath = path.resolve(process.cwd(), relativePath);
        return fullPath;
    };

    // Debug: List all registered routes
    const logRoutes = () => {
        console.log('📋 Registered API Routes:');
        console.log('   - GET  /health');
        console.log('   - GET  /health/detailed');
        console.log('   - /api/admin/*    (Admin routes with auth)');
        console.log('   - /api/tenant/*   (Tenant routes with auth)');
        console.log('   - /api/inventory/* (Inventory routes with auth)');
        console.log('   - /api/tenant/accounting/* (Accounting routes with auth)');
        console.log('   - /api/auth/*     (Public auth routes)');
        console.log('   - /api/user/*     (Public user routes - includes /test, /onboarding/business)');
        console.log('   - /api/super-admin/* (Public super-admin routes)');
        console.log('   - /api/upload/*   (Public upload routes)');
        console.log('   - /api/onboarding/* (Public onboarding routes - includes /business)');
    };

    // Dynamically load routes - skip if files don't exist
    const loadRoute = (relativePath) => {
        try {
            const fullPath = getRoutePath(relativePath);
            console.log(`🔍 Loading route: ${relativePath} -> ${fullPath}`);
            const route = require(fullPath);
            console.log(`✅ Route loaded: ${relativePath}`);
            return route;
        } catch (error) {
            console.warn(`⚠️  Route not found: ${relativePath} - ${error.message}`);
            if (error.code === 'MODULE_NOT_FOUND') {
                console.warn(`   Full path attempted: ${getRoutePath(relativePath)}`);
            }
            return (req, res) => {
                console.error(`❌ 501 Error: Route ${relativePath} not implemented or failed to load. error: ${error.message}`);
                res.status(501).json({ 
                    error: 'Route not implemented', 
                    path: relativePath,
                    details: error.message 
                });
            };
        }
    };

    // ADMIN ROUTES - Control Plane Database (SuperAdmin only)
    // Temporarily disabled due to legacy controller incompatibility
    // app.use("/api/admin", ...neonSafeAdminMiddlewareChain, loadRoute('routes/adminRoute.js'));
    
    // TENANT ROUTES - Neon-Safe Schema-per-Tenant (COMPREHENSIVE - includes all tenant endpoints)
    app.use("/api/tenant", ...neonSafeTenantMiddlewareChain, loadRoute('routes/tenant/tenant.routes.js'));
    
    // INVENTORY ROUTES (for /api/inventory/* paths)
    app.use("/api/inventory", ...neonSafeTenantMiddlewareChain, loadRoute('routes/inventoryRoutes.js'));
    
    // ACCOUNTING ROUTES
    app.use("/api/tenant/accounting", ...neonSafeTenantMiddlewareChain, loadRoute('routes/accountingRoute.js'));
    
    // PUBLIC ROUTES - No authentication required
    app.use("/api/auth", ...neonSafePublicMiddlewareChain, loadRoute('src/auth/auth.routes.js'));
    
    app.use("/api/user", ...neonSafePublicMiddlewareChain, loadRoute('routes/userRoute.js'));
    
    app.use("/api/super-admin", ...neonSafePublicMiddlewareChain, loadRoute('routes/superAdminRoute.js'));
    
    app.use("/api/upload", ...neonSafePublicMiddlewareChain, loadRoute('routes/uploadRoute.js'));
    
    app.use("/api/onboarding", ...neonSafePublicMiddlewareChain, loadRoute('routes/onboardingRoute.js'));
    
    console.log('✅ Neon-safe middleware chains applied successfully');
    logRoutes();
};

module.exports = {
    neonSafeAdminMiddlewareChain,
    neonSafeTenantMiddlewareChain,
    neonSafePublicMiddlewareChain,
    applyNeonSafeMiddlewareChains
};
