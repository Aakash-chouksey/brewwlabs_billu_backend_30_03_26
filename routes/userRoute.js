const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboardingController');
const { validate } = require('../middlewares/authValidation');
const { accountCreationLimiter } = require('../middlewares/authRateLimiting');
const { AuthErrorHandler } = require('../middlewares/authErrorHandler');

// TEST ROUTE - Confirm this router is working
// GET /api/user/test
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'User routes are working!',
        timestamp: new Date().toISOString(),
        path: req.originalUrl
    });
});

// Public Routes with Validation
// NOTE: /onboarding/business is also available at /api/onboarding/business via onboardingRoute.js
// This is kept for backward compatibility at /api/user/onboarding/business
router.post('/onboarding/business', accountCreationLimiter, validate('registration'), AuthErrorHandler.asyncHandler(onboardingController.onboardBusiness));

module.exports = router;
