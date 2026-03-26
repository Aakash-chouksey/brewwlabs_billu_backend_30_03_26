const path = require('path');
const { neonSafeTenantMiddleware, neonSafeModelInjection } = require('../../middlewares/tenantMiddleware');
const tenantStatusMiddleware = require('../../middlewares/tenantStatusMiddleware');
const { globalErrorHandler } = require('../../middlewares/globalErrorHandlers');
const { connectUnifiedDB } = require('../../config/unified_database');
const neonTransactionSafeExecutor = require('../../services/neonTransactionSafeExecutor');
const { enforcePublicSchema, resetSchemaToPublic } = require('../../middlewares/schemaEnforcement');

/**
 * Apply Neon-safe middleware chains to routes
 */
const applyNeonSafeMiddlewareChains = (app) => {
    console.log('🔐 Applying Neon-safe middleware chains...');

    // 🔒 LAZY DEFINITION: Created inside the function to ensure all modules are fully loaded
    // This prevents "ReferenceError" or "undefined middleware" crashes due to circular dependencies
    const adminChain = [
        require('../../middlewares/globalErrorHandlers').requestTimeoutMiddleware(30000),
        require('../../middlewares/globalErrorHandlers').responseValidationMiddleware,
        require('../../middlewares/tokenVerification').isVerifiedUser,
        require('../../middlewares/tokenVerification').adminOnlyMiddleware
    ];

    const tenantChain = [
        require('../../middlewares/globalErrorHandlers').requestTimeoutMiddleware(30000),
        require('../../middlewares/globalErrorHandlers').responseValidationMiddleware,
        require('../../middlewares/tokenVerification').isVerifiedUser,
        neonSafeTenantMiddleware,
        neonSafeModelInjection,
        tenantStatusMiddleware,
        require('../../middlewares/tokenVerification').tenantOnlyMiddleware
    ];

    const publicChain = [
        require('cookie-parser')(),
        require('../../middlewares/globalErrorHandlers').requestTimeoutMiddleware(300000), // Increased to 5min for intensive 8-level onboarding sync
        require('../../middlewares/globalErrorHandlers').responseValidationMiddleware
    ];

    // Initialize transaction executor health check
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
    const getRoutePath = (relativePath) => path.resolve(process.cwd(), relativePath);

    // Dynamically load routes
    const loadRoute = (relativePath) => {
        try {
            const fullPath = getRoutePath(relativePath);
            const route = require(fullPath);
            return route;
        } catch (error) {
            console.warn(`⚠️  Route not found: ${relativePath} - ${error.message}`);
            return (req, res) => {
                res.status(501).json({ 
                    success: false,
                    message: `Route not implemented: ${relativePath}`,
                    data: null,
                    error: error.message,
                    path: relativePath 
                });
            };
        }
    };

    // ADMIN ROUTES
    app.use("/api/admin", ...adminChain, loadRoute('routes/adminRoute.js'));
    
    // TENANT ROUTES
    app.use("/api/tenant", ...tenantChain, loadRoute('routes/tenant/tenant.routes.js'));
    
    // INVENTORY ROUTES
    app.use("/api/inventory", ...tenantChain, loadRoute('routes/inventoryRoutes.js'));
    
    // ACCOUNTING ROUTES
    app.use("/api/tenant/accounting", ...tenantChain, loadRoute('routes/accountingRoute.js'));
    
    // REPORT ROUTES (CRITICAL: Added missing report routes with tenant middleware)
    app.use("/api/reports", ...tenantChain, loadRoute('routes/reportRoute.js'));
    
    // LEGACY & PUBLIC
    app.use("/api", ...publicChain, loadRoute('routes/legacyRoute.js'));
    app.use("/api/auth", ...publicChain, loadRoute('src/auth/auth.routes.js'));
    app.use("/api/user", ...publicChain, loadRoute('routes/userRoute.js'));
    app.use("/api/super-admin", ...publicChain, loadRoute('routes/superAdminRoute.js'));
    app.use("/api/upload", ...publicChain, loadRoute('routes/uploadRoute.js'));
    
    // ONBOARDING (CRITICAL: Public Schema forced)
    app.use("/api/onboarding", 
        enforcePublicSchema, 
        ...publicChain, 
        loadRoute('routes/onboardingRoute.js'),
        resetSchemaToPublic
    );
    
    console.log('✅ Neon-safe middleware chains applied successfully');
};

module.exports = {
    applyNeonSafeMiddlewareChains,
    // Add getters for external access to prevent uninitialized access
    get neonSafeAdminMiddlewareChain() {
        return [
            require('../../middlewares/globalErrorHandlers').requestTimeoutMiddleware(30000),
            require('../../middlewares/globalErrorHandlers').responseValidationMiddleware,
            require('../../middlewares/tokenVerification').isVerifiedUser,
            require('../../middlewares/tokenVerification').adminOnlyMiddleware
        ];
    },
    get tenantMiddlewareChain() {
        return [
            require('../../middlewares/globalErrorHandlers').requestTimeoutMiddleware(30000),
            require('../../middlewares/globalErrorHandlers').responseValidationMiddleware,
            require('../../middlewares/tokenVerification').isVerifiedUser,
            require('../../middlewares/tenantMiddleware').neonSafeTenantMiddleware,
            require('../../middlewares/tenantMiddleware').neonSafeModelInjection,
            require('../../middlewares/tenantStatusMiddleware'),
            require('../../middlewares/tokenVerification').tenantOnlyMiddleware
        ];
    },
    get neonSafePublicMiddlewareChain() {
        return [
            require('cookie-parser')(),
            require('../../middlewares/globalErrorHandlers').requestTimeoutMiddleware(120000),
            require('../../middlewares/globalErrorHandlers').responseValidationMiddleware
        ];
    }
};
