/**
 * Onboarding Routes
 * Public endpoints for business registration
 */

const express = require('express');
const router = express.Router();
const { onboardBusiness } = require('../controllers/onboardingController');

// Basic validation middleware
const validateOnboarding = (req, res, next) => {
    // Map minimal body to internal fields for validation
    const businessName = req.body.businessName || req.body.name;
    const businessEmail = req.body.businessEmail || req.body.email;
    const adminName = req.body.adminName || req.body.name || 'Admin';
    const adminEmail = req.body.adminEmail || req.body.email;
    const adminPassword = req.body.adminPassword || req.body.password;

    const errors = [];
    
    if (!businessName || businessName.length < 2) {
        errors.push('Business name (or name) is required');
    }
    
    if (!businessEmail || !businessEmail.includes('@')) {
        errors.push('Valid business email (or email) is required');
    }
    
    if (!adminName) {
        errors.push('Admin name is required');
    }
    
    if (!adminEmail || !adminEmail.includes('@')) {
        errors.push('Valid admin email is required');
    }
    
    if (!adminPassword || adminPassword.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }
    
    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }
    
    next();
};

// Public onboarding endpoint
router.post('/business', validateOnboarding, onboardBusiness);

module.exports = router;
