#!/usr/bin/env node

/**
 * AUTH SERVICE VALIDATION TEST
 * Tests auth service functionality without full database connection
 */

require('dotenv').config();

console.log('🧪 AUTH SERVICE VALIDATION TEST');
console.log('================================\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        testsFailed++;
    }
}

// Test 1: Auth Service can be imported
test('Auth Service Module Import', () => {
    const authService = require('../../services/auth.service');
    if (!authService) {
        throw new Error('Auth service not found');
    }
});

// Test 2: Auth Service has required methods
test('Auth Service Methods', () => {
    const authService = require('../../services/auth.service');
    const requiredMethods = ['login', 'generateAccessToken', 'generateRefreshToken', 'verifyRefreshToken', 'logout', 'changePassword'];
    
    for (const method of requiredMethods) {
        if (typeof authService[method] !== 'function') {
            throw new Error(`Missing method: ${method}`);
        }
    }
});

// Test 3: Token Service is accessible
test('Token Service Integration', () => {
    const tokenService = require('../../services/tokenService');
    if (!tokenService) {
        throw new Error('Token service not accessible');
    }
});

// Test 4: Auth Controller can be imported
test('Auth Controller Module Import', () => {
    const authController = require('../../src/auth/auth.controller');
    if (!authController) {
        throw new Error('Auth controller not found');
    }
});

// Test 5: Auth Controller has required methods
test('Auth Controller Methods', () => {
    const authController = require('../../src/auth/auth.controller');
    const requiredMethods = ['login', 'logout', 'me', 'refreshTokens', 'sendOtp', 'verifyOtp', 'changePassword', 'invalidateAllTokens'];
    
    for (const method of requiredMethods) {
        if (typeof authController[method] !== 'function') {
            throw new Error(`Missing method: ${method}`);
        }
    }
});

// Test 6: Auth Routes can be imported
test('Auth Routes Module Import', () => {
    const authRoutes = require('../../src/auth/auth.routes');
    if (!authRoutes) {
        throw new Error('Auth routes not found');
    }
});

// Test 7: Test token generation (without database)
test('Token Generation', () => {
    const authService = require('../../services/auth.service');
    
    const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
        businessId: 'test-business-id',
        outletId: 'test-outlet-id',
        panelType: 'TENANT',
        tokenVersion: 0
    };
    
    const accessToken = authService.generateAccessToken(mockUser);
    const refreshToken = authService.generateRefreshToken(mockUser);
    
    if (!accessToken || typeof accessToken !== 'string') {
        throw new Error('Access token generation failed');
    }
    
    if (!refreshToken || typeof refreshToken !== 'string') {
        throw new Error('Refresh token generation failed');
    }
    
    // Verify tokens are JWT format (three parts separated by dots)
    const accessParts = accessToken.split('.');
    const refreshParts = refreshToken.split('.');
    
    if (accessParts.length !== 3) {
        throw new Error('Access token is not valid JWT format');
    }
    
    if (refreshParts.length !== 3) {
        throw new Error('Refresh token is not valid JWT format');
    }
});

// Test 8: Test token verification
test('Token Verification', () => {
    const authService = require('../../services/auth.service');
    const tokenService = require('../../services/tokenService');
    
    const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
        businessId: 'test-business-id',
        outletId: 'test-outlet-id',
        panelType: 'TENANT',
        tokenVersion: 0
    };
    
    const accessToken = authService.generateAccessToken(mockUser);
    
    // Verify the token
    const decoded = tokenService.verifyToken(accessToken);
    
    if (!decoded) {
        throw new Error('Token verification failed');
    }
    
    if (decoded.email !== mockUser.email) {
        throw new Error('Token payload incorrect');
    }
    
    if (decoded.role !== mockUser.role) {
        throw new Error('Token role incorrect');
    }
});

// Test 9: Environment variables check
test('Environment Variables', () => {
    const requiredEnvVars = ['DATABASE_URL', 'ACCESS_TOKEN_SECRET', 'JWT_SECRET'];
    
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            throw new Error(`Missing environment variable: ${envVar}`);
        }
    }
});

// Test 10: Auth Middleware exists
test('Auth Middleware Files', () => {
    const fs = require('fs');
    const path = require('path');
    
    const requiredFiles = [
        './middlewares/authValidation.js',
        './middlewares/authRateLimiting.js',
        './middlewares/authErrorHandler.js',
        './middlewares/tokenVerification.js'
    ];
    
    for (const file of requiredFiles) {
        if (!fs.existsSync(path.join(__dirname, file))) {
            throw new Error(`Missing middleware file: ${file}`);
        }
    }
});

// Print summary
console.log('\n📊 TEST SUMMARY');
console.log('================');
console.log(`Total Tests: ${testsPassed + testsFailed}`);
console.log(`Passed: ${testsPassed} ✅`);
console.log(`Failed: ${testsFailed} ❌`);

if (testsFailed === 0) {
    console.log('\n🎉 ALL AUTH SERVICE TESTS PASSED!');
    console.log('✅ Auth API components are properly configured');
    console.log('✅ Token generation and verification work correctly');
    console.log('✅ All required modules are in place');
    process.exit(0);
} else {
    console.log('\n❌ SOME TESTS FAILED');
    console.log('Please check the errors above');
    process.exit(1);
}
