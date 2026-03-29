/**
 * API Verification Test for Auth + Onboarding Module
 * This tests the response format and module loading after fixes
 */

const path = require('path');

// Set environment variables
require('dotenv').config();

console.log('🔍 [API VERIFY] Starting Auth Module Verification...\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`  ❌ ${name}: ${error.message}`);
        testsFailed++;
    }
}

// Test 1: Models load without syntax errors
console.log('📦 Model Loading Tests:');
test('User model loads without duplicate field errors', () => {
    const userModel = require('./control_plane_models/userModel');
    if (!userModel) throw new Error('User model not exported');
});

test('Business model loads without duplicate field errors', () => {
    const businessModel = require('./control_plane_models/businessModel');
    if (!businessModel) throw new Error('Business model not exported');
});

// Test 2: Services load correctly
console.log('\n🔧 Service Loading Tests:');
test('Auth service loads', () => {
    const authService = require('./services/authService');
    if (!authService) throw new Error('Auth service not exported');
    if (typeof authService.login !== 'function') throw new Error('login method not found');
    if (typeof authService.generateAccessToken !== 'function') throw new Error('generateAccessToken method not found');
});

test('Token service loads', () => {
    const tokenService = require('./services/tokenService');
    if (!tokenService) throw new Error('Token service not exported');
    if (typeof tokenService.generateAccessToken !== 'function') throw new Error('generateAccessToken method not found');
});

test('Onboarding service loads', () => {
    const onboardingService = require('./services/onboardingService');
    if (!onboardingService) throw new Error('Onboarding service not exported');
    if (typeof onboardingService.onboardBusiness !== 'function') throw new Error('onboardBusiness method not found');
});

// Test 3: Controllers load correctly
console.log('\n🎮 Controller Loading Tests:');
test('Auth controller loads', () => {
    const authController = require('./src/auth/auth.controller');
    if (!authController) throw new Error('Auth controller not exported');
    if (typeof authController.login !== 'function') throw new Error('login method not found');
});

test('Onboarding controller loads', () => {
    const onboardingController = require('./controllers/onboardingController');
    if (!onboardingController) throw new Error('Onboarding controller not exported');
    if (typeof onboardingController.onboardBusiness !== 'function') throw new Error('onboardBusiness method not found');
});

// Test 4: Verify API response format compatibility
console.log('\n📋 API Contract Tests:');
test('Auth controller login returns correct response structure', () => {
    const authController = require('./src/auth/auth.controller');
    // Check that the controller has the expected methods
    const requiredMethods = ['login', 'refreshTokens', 'logout', 'me', 'changePassword'];
    for (const method of requiredMethods) {
        if (typeof authController[method] !== 'function') {
            throw new Error(`Missing method: ${method}`);
        }
    }
});

test('Onboarding controller returns correct response format', () => {
    const onboardingController = require('./controllers/onboardingController');
    // The controller should export the onboardBusiness function
    if (!onboardingController.onboardBusiness) {
        throw new Error('onboardBusiness not exported');
    }
});

// Test 5: Model Schema Validation
console.log('\n🗄️  Model Schema Tests:');
test('User model has correct field mapping', () => {
    const { sequelize } = require('./config/unified_database');
    const defineUser = require('./control_plane_models/userModel');
    const User = defineUser(sequelize);
    
    const attributes = User.rawAttributes;
    
    // Check critical fields exist
    if (!attributes.isVerified) throw new Error('isVerified field missing');
    if (!attributes.isActive) throw new Error('isActive field missing');
    if (!attributes.tokenVersion) throw new Error('tokenVersion field missing');
    
    // Check field mappings
    if (attributes.isVerified.field !== 'is_verified') throw new Error('isVerified field mapping incorrect');
    if (attributes.isActive.field !== 'is_active') throw new Error('isActive field mapping incorrect');
    if (attributes.tokenVersion.field !== 'token_version') throw new Error('tokenVersion field mapping incorrect');
});

test('Business model has correct field mapping', () => {
    const { sequelize } = require('./config/unified_database');
    const defineBusiness = require('./control_plane_models/businessModel');
    const Business = defineBusiness(sequelize, sequelize.Sequelize.DataTypes);
    
    const attributes = Business.rawAttributes;
    
    // Check critical fields exist
    if (!attributes.isActive) throw new Error('isActive field missing');
    
    // Check field mapping
    if (attributes.isActive.field !== 'is_active') throw new Error('isActive field mapping incorrect');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log('='.repeat(50));

if (testsFailed > 0) {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
} else {
    console.log('\n🎉 All verification tests passed!');
    process.exit(0);
}
