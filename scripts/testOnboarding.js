#!/usr/bin/env node

/**
 * Test onboarding via direct service call
 */

require('dotenv').config({ override: true });
const { connectUnifiedDB } = require('../config/unified_database');
const onboardingService = require('../services/onboarding.service');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const color = colors[level] || colors.reset;
  console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`);
}

async function testOnboarding() {
  log('bright', '🧪 TESTING ONBOARDING');
  log('bright', '====================');

  try {
    // Connect to database
    log('blue', '🔌 Connecting to database...');
    await connectUnifiedDB();
    log('green', '✅ Database connected');

    // Test onboarding
    const testData = {
      businessName: `Test Cafe ${Date.now()}`,
      businessEmail: `testcafe${Date.now()}@example.com`,
      businessPhone: '+1234567890',
      businessAddress: '123 Test Street',
      adminName: 'Test Admin',
      adminEmail: `admin${Date.now()}@testcafe.com`,
      adminPassword: 'SecurePass123!',
      cafeType: 'SOLO'
    };

    log('blue', '🚀 Starting onboarding...');
    log('cyan', `   Business: ${testData.businessName}`);
    log('cyan', `   Email: ${testData.businessEmail}`);

    const result = await onboardingService.onboardBusiness(testData);

    if (result.success) {
      log('green', '✅ Onboarding successful!');
      log('cyan', `   Business ID: ${result.data.businessId}`);
      log('cyan', `   Schema: ${result.data.schemaName}`);
      log('cyan', `   Tables created: ${result.data.tablesCreated}`);
      
      // Save the result for verification
      const fs = require('fs');
      fs.writeFileSync('/tmp/onboarding_result.json', JSON.stringify(result, null, 2));
      log('green', '✅ Result saved to /tmp/onboarding_result.json');
      
      return result;
    } else {
      log('red', '❌ Onboarding failed');
      return null;
    }

  } catch (error) {
    log('red', `❌ Error: ${error.message}`);
    console.error(error.stack);
    return null;
  }
}

if (require.main === module) {
  testOnboarding().then(result => {
    if (result) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  });
}

module.exports = { testOnboarding };
