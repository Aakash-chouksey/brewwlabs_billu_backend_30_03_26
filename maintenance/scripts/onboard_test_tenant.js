/**
 * ONBOARD TEST TENANT
 * ===================
 * Quickly creates a full tenant using OnboardingService
 */

require('dotenv').config();
const onboardingService = require('../../services/onboardingService');
const { sequelize } = require('../../config/unified_database');

async function onboardTest() {
    const id = Math.random().toString(36).substr(2, 5);
    const data = {
        businessName: `Test Business ${id}`,
        businessEmail: `test-${id}@business.com`,
        businessPhone: '1234567890',
        businessAddress: '123 Test St',
        gstNumber: '29ABCDE1234F1Z5',
        adminName: 'Test Admin',
        adminEmail: `admin-${id}@test.com`,
        adminPassword: 'password123',
        cafeType: 'CAFE'
    };

    console.log('🏗️ Onboarding test tenant...');
    
    try {
        const result = await onboardingService.onboardBusiness(data);
        console.log('✅ Onboarding successful:', result.data.schemaName);
        return result.data;
    } catch (error) {
        console.error('🔥 Onboarding failed:', error.message);
    } finally {
        await sequelize.close();
    }
}

onboardTest();
