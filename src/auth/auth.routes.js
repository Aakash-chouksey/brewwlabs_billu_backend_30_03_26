const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { isVerifiedUser } = require('../../middlewares/tokenVerification');
const { 
    loginLimiter, 
    authLimiter, 
    otpLimiter, 
    passwordResetLimiter, 
    accountCreationLimiter,
    checkAccountLockout 
} = require('../../middlewares/authRateLimiting');
const { requirePermission } = require('../../middlewares/rbac');
const { validate } = require('../../middlewares/authValidation');
const { AuthErrorHandler, globalAuthErrorHandler } = require('../../middlewares/authErrorHandler');

// Debug endpoint for testing reports (development only)
// Debug endpoint for testing reports (development only)
if (process.env.NODE_ENV !== 'production') {
    const neonTransactionSafeExecutor = require('../../services/neonTransactionSafeExecutor');
    
    router.get('/debug/reports', async (req, res) => {
        try {
            console.log('🔧 DEBUG: Public reports endpoint called');
            const reportController = require('../../controllers/reportController');
            const { sequelize } = require('../../config/unified_database');
            
            const businessId = req.query.businessId || 'test-business-id';
            const outletId = req.query.outletId || 'test-outlet-id';
            
            // PRE-CHECK: Prevent executor crash on missing schemas
            // This satisfies PHASE 8 by returning a standard error instead of a 500 crash
            const schemaName = `tenant_${businessId}`;
            const schemaResults = await sequelize.query(
                `SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema`,
                { 
                    replacements: { schema: schemaName }, 
                    type: sequelize.QueryTypes.SELECT 
                }
            );

            if (!schemaResults || schemaResults.length === 0) {
                // AUTO-PROVISIONING: If it's the debug-business, onboard it on the fly!
                if (businessId === 'debug-business') {
                    console.log('🏗️  Auto-provisioning debug-business...');
                    const onboardingService = require('../../services/onboardingService');
                    try {
                        await onboardingService.onboardBusiness({
                            businessName: "Debug Business",
                            businessEmail: "debug@business.local",
                            businessPhone: "0000000000",
                            businessAddress: "Debug Ave",
                            adminName: "Debug Admin",
                            adminEmail: "admin@debug.local",
                            adminPassword: "password123",
                            forcedBusinessId: 'debug-business',
                            forcedOutletId: 'debug-outlet'
                        });
                        console.log('✅ Auto-provisioning complete! Proceeding with query...');
                    } catch (onboardingError) {
                        console.warn('⚠️ Auto-onboarding failed (likely already exists in registry but schema missing):', onboardingError.message);
                        // If it failed because it exists in registry, we should still try to create the schema specifically
                        await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "tenant_debug-business"`);
                    }
                } else {
                    return res.status(404).json({
                        success: false,
                        data: null,
                        message: `Debug error: Business '${businessId}' has not been onboarded (Schema '${schemaName}' is missing).`,
                        error: "SCHEMA_NOT_FOUND"
                    });
                }
            }
            
            // Mock request object for testing with executeRead properly bound
            const mockReq = {
                query: req.query,
                businessId: businessId,
                outletId: outletId,
                tenantId: businessId, // Required for executeRead
                auth: { 
                    role: 'ADMIN',
                    businessId: businessId,
                    outletId: outletId
                },
                models: {
                    sequelize: {
                        query: async () => [],
                        QueryTypes: { SELECT: 'SELECT' }
                    }
                },
                // Add executeRead function that uses the real executor
                executeRead: async (operation) => {
                    return await neonTransactionSafeExecutor.executeRead(businessId, operation);
                },
                // Also add executeWithTenant for write operations
                executeWithTenant: async (operation, options = {}) => {
                    return await neonTransactionSafeExecutor.executeWithTenant(businessId, operation, options);
                }
            };
            
            // Call the reports controller with mock request if it exists
            const handler = reportController.getReportsOverview || reportController.getDailySales;
            if (typeof handler !== 'function') {
                return res.status(500).json({
                    success: false,
                    message: 'No report handler found'
                });
            }

            handler(mockReq, res, async (err) => {
                if (err) {
                    console.error('Debug reports error:', err);
                    if (!res.headersSent) {
                        res.status(500).json({
                            success: false,
                            data: null,
                            message: 'Debug reports error',
                            error: err.message
                        });
                    }
                }
            });
        } catch (error) {
            console.error('🔥 Debug reports crash prevented:', error.message);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    data: null,
                    message: 'Debug reports internal error',
                    error: error.message
                });
            }
        }
    });
}

// Public Routes with Rate Limiting and Validation
router.post('/login', checkAccountLockout, loginLimiter, validate('login'), AuthErrorHandler.asyncHandler(authController.login));
router.post('/logout', authLimiter, AuthErrorHandler.asyncHandler(authController.logout));
router.post('/send-otp', otpLimiter, validate('email'), AuthErrorHandler.asyncHandler(authController.sendOtp));
router.post('/verify-otp', otpLimiter, validate('otp'), AuthErrorHandler.asyncHandler(authController.verifyOtp));
router.post('/refresh', authLimiter, AuthErrorHandler.asyncHandler(authController.refreshTokens));
router.post('/firebase-google', authLimiter, AuthErrorHandler.asyncHandler(authController.firebaseGoogleAuth));

// Google Auth
router.get('/google', (req, res) => {
    res.status(501).json({
        success: false,
        message: "Google Auth not implemented",
        status: "STUB"
    });
});

router.get('/google/callback', (req, res) => {
    res.status(501).json({
        success: false,
        message: "Google Auth callback not implemented",
        status: "STUB"
    });
});

// Protected Routes with Validation and RBAC
router.get('/me', isVerifiedUser, AuthErrorHandler.asyncHandler(authController.me));
router.post('/change-password', isVerifiedUser, requirePermission('USER_UPDATE'), validate('passwordChange'), AuthErrorHandler.asyncHandler(authController.changePassword));
router.post('/invalidate-tokens', isVerifiedUser, requirePermission('USER_UPDATE'), AuthErrorHandler.asyncHandler(authController.invalidateAllTokens));

// Debug route (development only)
if (process.env.NODE_ENV === 'development') {
    router.get('/debug', AuthErrorHandler.asyncHandler(authController.debugAuth));
}

// Global error handler for auth routes
router.use(globalAuthErrorHandler);

module.exports = router;
