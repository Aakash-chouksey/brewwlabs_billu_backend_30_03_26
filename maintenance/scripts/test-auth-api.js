#!/usr/bin/env node

/**
 * AUTH API TEST SCRIPT
 * Tests all auth endpoints to ensure they work properly
 */

require('dotenv').config();

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:8000/api';
const AUTH_ENDPOINT = `${API_BASE_URL}/auth`;

// Test user credentials
const TEST_USER = {
    email: 'authtest@example.com',
    password: 'Password123!',
    name: 'Auth Test User',
    role: 'ADMIN'
};

let testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

function logTest(name, passed, message = '') {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${name}: ${message}`);
    
    testResults.tests.push({
        name,
        passed,
        message
    });
    
    if (passed) {
        testResults.passed++;
    } else {
        testResults.failed++;
    }
}

async function setupTestUser() {
    try {
        console.log('\n🔧 Setting up test user...');
        
        const { sequelize } = require('../../config/unified_database');
        const getUserModel = require('../../control_plane_models/userModel');
        const User = getUserModel(sequelize);
        
        // Clean up existing test user
        await User.destroy({ where: { email: TEST_USER.email } });
        
        // Create test user with hashed password
        const hashedPassword = await bcrypt.hash(TEST_USER.password, 10);
        
        const user = await User.create({
            id: uuidv4(),
            email: TEST_USER.email,
            name: TEST_USER.name,
            password: hashedPassword,
            role: TEST_USER.role,
            panelType: 'TENANT',
            isActive: true,
            isVerified: true,
            businessId: uuidv4(),
            outletId: uuidv4()
        });
        
        console.log(`✅ Test user created: ${user.email}`);
        return user;
        
    } catch (error) {
        console.error('❌ Failed to create test user:', error.message);
        throw error;
    }
}

async function cleanupTestUser() {
    try {
        console.log('\n🧹 Cleaning up test user...');
        
        const { sequelize } = require('../../config/unified_database');
        const getUserModel = require('../../control_plane_models/userModel');
        const User = getUserModel(sequelize);
        
        await User.destroy({ where: { email: TEST_USER.email } });
        console.log('✅ Test user cleaned up');
        
    } catch (error) {
        console.error('❌ Failed to cleanup test user:', error.message);
    }
}

async function testLogin() {
    console.log('\n🧪 Testing: Login');
    
    try {
        const response = await axios.post(`${AUTH_ENDPOINT}/login`, {
            email: TEST_USER.email,
            password: TEST_USER.password
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data.success && response.data.accessToken && response.data.user) {
            logTest('Login', true, `User ${response.data.user.email} logged in successfully`);
            return {
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken,
                user: response.data.user
            };
        } else {
            logTest('Login', false, 'Invalid response format');
            return null;
        }
        
    } catch (error) {
        logTest('Login', false, error.response?.data?.message || error.message);
        return null;
    }
}

async function testMe(accessToken) {
    console.log('\n🧪 Testing: Get Current User (/me)');
    
    try {
        const response = await axios.get(`${AUTH_ENDPOINT}/me`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            withCredentials: true
        });
        
        if (response.data.success && response.data.user) {
            logTest('Get Current User', true, `User: ${response.data.user.email}`);
            return true;
        } else {
            logTest('Get Current User', false, 'Invalid response format');
            return false;
        }
        
    } catch (error) {
        logTest('Get Current User', false, error.response?.data?.message || error.message);
        return false;
    }
}

async function testRefreshToken(refreshToken) {
    console.log('\n🧪 Testing: Refresh Token');
    
    try {
        const response = await axios.post(`${AUTH_ENDPOINT}/refresh`, {}, {
            headers: {
                'Cookie': `refreshToken=${refreshToken}`
            },
            withCredentials: true
        });
        
        if (response.data.success && response.data.accessToken) {
            logTest('Refresh Token', true, 'New access token generated');
            return response.data.accessToken;
        } else {
            logTest('Refresh Token', false, 'Invalid response format');
            return null;
        }
        
    } catch (error) {
        logTest('Refresh Token', false, error.response?.data?.message || error.message);
        return null;
    }
}

async function testInvalidLogin() {
    console.log('\n🧪 Testing: Invalid Login (should fail)');
    
    try {
        const response = await axios.post(`${AUTH_ENDPOINT}/login`, {
            email: TEST_USER.email,
            password: 'wrongpassword'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        logTest('Invalid Login', false, 'Should have returned 401');
        return false;
        
    } catch (error) {
        if (error.response && error.response.status === 401) {
            logTest('Invalid Login', true, 'Correctly rejected invalid credentials');
            return true;
        } else {
            logTest('Invalid Login', false, `Unexpected error: ${error.message}`);
            return false;
        }
    }
}

async function testLogout(accessToken) {
    console.log('\n🧪 Testing: Logout');
    
    try {
        const response = await axios.post(`${AUTH_ENDPOINT}/logout`, {}, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            withCredentials: true
        });
        
        if (response.data.success) {
            logTest('Logout', true, 'Logout successful');
            return true;
        } else {
            logTest('Logout', false, 'Logout failed');
            return false;
        }
        
    } catch (error) {
        logTest('Logout', false, error.response?.data?.message || error.message);
        return false;
    }
}

async function testOTPEndpoints() {
    console.log('\n🧪 Testing: OTP Endpoints');
    
    try {
        // Test send OTP
        const sendResponse = await axios.post(`${AUTH_ENDPOINT}/send-otp`, {
            email: 'superadmin@brewwlabs.com'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (sendResponse.data.success) {
            logTest('Send OTP', true, 'OTP send endpoint accessible');
        } else {
            logTest('Send OTP', false, 'Failed to send OTP');
        }
        
    } catch (error) {
        logTest('Send OTP', false, error.response?.data?.message || error.message);
    }
    
    try {
        // Test verify OTP with development credentials
        const verifyResponse = await axios.post(`${AUTH_ENDPOINT}/verify-otp`, {
            email: 'superadmin@brewwlabs.com',
            otp: '123456'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (verifyResponse.data.success && verifyResponse.data.accessToken) {
            logTest('Verify OTP', true, 'OTP verification successful');
        } else {
            logTest('Verify OTP', false, 'OTP verification failed');
        }
        
    } catch (error) {
        logTest('Verify OTP', false, error.response?.data?.message || error.message);
    }
}

async function runAllTests() {
    console.log('🚀 STARTING AUTH API TESTS');
    console.log('==========================');
    
    try {
        // Setup
        await setupTestUser();
        
        // Run tests
        const loginResult = await testLogin();
        
        if (loginResult) {
            await testMe(loginResult.accessToken);
            await testRefreshToken(loginResult.refreshToken);
            await testLogout(loginResult.accessToken);
        }
        
        await testInvalidLogin();
        await testOTPEndpoints();
        
    } catch (error) {
        console.error('💥 Test suite error:', error.message);
    } finally {
        // Cleanup
        await cleanupTestUser();
        
        // Print summary
        console.log('\n📊 TEST SUMMARY');
        console.log('===============');
        console.log(`Total Tests: ${testResults.tests.length}`);
        console.log(`Passed: ${testResults.passed} ✅`);
        console.log(`Failed: ${testResults.failed} ❌`);
        console.log(`Success Rate: ${((testResults.passed / testResults.tests.length) * 100).toFixed(1)}%`);
        
        if (testResults.failed === 0) {
            console.log('\n🎉 ALL TESTS PASSED! Auth API is working properly.');
            process.exit(0);
        } else {
            console.log('\n❌ SOME TESTS FAILED. Please check the errors above.');
            process.exit(1);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    runAllTests();
}

module.exports = {
    runAllTests,
    testLogin,
    testMe,
    testLogout,
    testInvalidLogin
};
