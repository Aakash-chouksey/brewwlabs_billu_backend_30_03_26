const path = require('path');
const { neonSafeTenantMiddleware, neonSafeModelInjection } = require('../../middlewares/tenantMiddleware');
const tenantStatusMiddleware = require('../../middlewares/tenantStatusMiddleware');
const neonTransactionSafeExecutor = require('../../services/neonTransactionSafeExecutor');
const { enforcePublicSchema, resetSchemaToPublic } = require('../../middlewares/schemaEnforcement');

/**
 * Apply Neon-safe middleware chains to routes
 */
const applyNeonSafeMiddlewareChains = (app) => {
    console.log('🔐 Applying Neon-safe middleware chains...');

    // 🔒 LAZY DEFINITION: Created inside the function to ensure all modules are fully loaded
    const { standardResponseMiddleware: standardResponse } = require('../../utils/standardResponse');

    const adminChain = [
        require('../../middlewares/globalErrorHandlers').requestTimeoutMiddleware(30000),
        standardResponse,
        require('../../middlewares/tokenVerification').isVerifiedUser,
        require('../../middlewares/tokenVerification').adminOnlyMiddleware
    ];

    const tenantChain = [
        require('../../middlewares/globalErrorHandlers').requestTimeoutMiddleware(30000),
        standardResponse,
        require('../../middlewares/tokenVerification').isVerifiedUser,
        neonSafeTenantMiddleware,
        neonSafeModelInjection,
        tenantStatusMiddleware,
        require('../../middlewares/tokenVerification').tenantOnlyMiddleware
    ];

    const publicChain = [
        require('cookie-parser')(),
        require('../../middlewares/globalErrorHandlers').requestTimeoutMiddleware(120000),
        standardResponse
    ];

    // Helper to get absolute path
    const getRoutePath = (relativePath) => path.resolve(process.cwd(), relativePath);

    // Dynamically load routes
    const loadRoute = (relativePath) => {
        try {
            const fullPath = getRoutePath(relativePath);
            const route = require(fullPath);
            
            // Safety: Ensure route is not undefined (prevents Express crash)
            if (!route) {
                console.warn(`⚠️  Route module ${relativePath} exported undefined`);
                return (req, res) => res.status(501).json({ success: false, message: `Route module exported undefined: ${relativePath}` });
            }
            
            return route;
        } catch (error) {
            console.error(`❌ FAILED TO LOAD ROUTE: ${relativePath}`);
            console.error(`   Error: ${error.message}`);
            console.error(`   Stack: ${error.stack}`);
            return (req, res) => {
                res.status(501).json({ 
                    success: false,
                    message: `Route module failed to load: ${relativePath}`,
                    data: null,
                    error: error.message,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                    path: relativePath 
                });
            };
        }
    };

    // ==========================================
    // CONTROL PLANE ROUTES (Public Schema)
    // ==========================================
    app.use("/api/admin", ...adminChain, loadRoute('routes/adminRoute.js'));
    app.use("/api/super-admin", ...publicChain, loadRoute('routes/superAdminRoute.js'));
    app.use("/api/auth", ...publicChain, loadRoute('src/auth/auth.routes.js'));
    app.use("/api/user", ...publicChain, loadRoute('routes/userRoute.js'));
    app.use("/api/upload", ...publicChain, loadRoute('routes/uploadRoute.js'));
    
    // ONBOARDING (Strict Public Schema Enforcement)
    app.use("/api/onboarding", 
        enforcePublicSchema, 
        ...publicChain, 
        loadRoute('routes/onboardingRoute.js'),
        resetSchemaToPublic
    );
    
    // ==========================================
    // TENANT ROUTES (Consolidated & Neon-Safe)
    // ==========================================
    // Primary mount point for all tenant operations
    app.use("/api/tenant", ...tenantChain, loadRoute('routes/tenant/tenant.routes.js'));
    
    // Legacy mount points kept for backward compatibility but using the same tenantChain
    app.use("/api/inventory", ...tenantChain, loadRoute('routes/tenant/tenant.routes.js'));
    app.use("/api/reports", ...tenantChain, loadRoute('routes/tenant/tenant.routes.js'));
    
    // Legacy /api mount (use with caution)
    app.use("/api", ...publicChain, loadRoute('routes/legacyRoute.js'));
    
    console.log('✅ Neon-safe middleware chains applied successfully');
};

module.exports = {
    applyNeonSafeMiddlewareChains
};
