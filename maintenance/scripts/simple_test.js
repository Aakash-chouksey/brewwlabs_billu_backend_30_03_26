const fs = require('fs');

async function simpleTest() {
    const result = {
        timestamp: new Date().toISOString(),
        steps: [],
        success: false,
        error: null
    };
    
    try {
        // Step 1: Environment
        require('dotenv').config();
        result.steps.push('✅ Environment loaded');
        result.steps.push(`NODE_ENV: ${process.env.NODE_ENV}`);
        result.steps.push(`DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
        
        // Step 2: Database connections
        const { sequelize: sharedSequelize } = require('../../config/database_postgres');
        result.steps.push('✅ Shared database config loaded');
        
        await sharedSequelize.authenticate();
        result.steps.push('✅ Shared database connected');
        
        const { controlPlaneSequelize } = require('../../config/control_plane_db');
        result.steps.push('✅ Control plane config loaded');
        
        await controlPlaneSequelize.authenticate();
        result.steps.push('✅ Control plane connected');
        
        // Step 3: Onboarding service
        const onboardingService = require('../../services/onboarding.service');
        result.steps.push('✅ Onboarding service loaded');
        
        result.success = true;
        result.steps.push('✅ All components loaded successfully');
        
    } catch (error) {
        result.error = error.message;
        result.steps.push(`❌ Error: ${error.message}`);
    }
    
    // Write result to file
    fs.writeFileSync('test_result.json', JSON.stringify(result, null, 2));
    console.log('Test completed. Check test_result.json');
}

simpleTest();
