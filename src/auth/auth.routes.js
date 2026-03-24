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
if (process.env.NODE_ENV !== 'production') {
    router.get('/debug/reports', (req, res) => {
        console.log('🔧 DEBUG: Public reports endpoint called');
        const reportController = require('../../controllers/reportController');
        
        // Mock request object for testing
        const mockReq = {
            query: req.query,
            businessId: req.query.businessId || 'test-business-id',
            outletId: req.query.outletId || 'test-outlet-id',
            models: {
                sequelize: {
                    query: async () => [],
                    QueryTypes: { SELECT: 'SELECT' }
                }
            }
        };
        
        // Call the reports controller with mock request
        reportController.getReportsOverview(mockReq, res, (err) => {
            if (err) {
                console.error('Debug reports error:', err);
                res.status(500).json({
                    success: false,
                    message: 'Debug reports error',
                    error: err.message
                });
            }
        });
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
