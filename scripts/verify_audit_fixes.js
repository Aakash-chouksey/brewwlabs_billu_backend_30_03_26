const { initializeTenantModels } = require('../src/db/tenantModelRegistry');
const { sequelize } = require('../config/database_postgres');

async function verifyModels() {
    console.log('🧪 Verifying Tenant Model Registry...');
    
    try {
        const models = await initializeTenantModels(sequelize);
        const modelNames = Object.keys(models).filter(k => k !== 'sequelize');
        
        console.log(`✅ Loaded ${modelNames.length} models: ${modelNames.join(', ')}`);
        
        // Check for specific fields
        const productAttributes = models.Product.rawAttributes;
        const expectedFields = ['track_stock', 'min_stock_level', 'max_stock_level'];
        
        for (const field of expectedFields) {
            const attr = Object.values(productAttributes).find(a => a.field === field);
            if (attr) {
                console.log(`✅ Product model has field mapping for: ${field}`);
            } else {
                console.error(`❌ Product model missing field mapping for: ${field}`);
            }
        }
        
        // Verify underscored
        if (models.Product.options.underscored) {
            console.log('✅ Product model has underscored: true');
        } else {
            console.error('❌ Product model missing underscored: true');
        }

    } catch (error) {
        console.error('❌ Model verification failed:', error.message);
    }
}

async function verifyOnboarding() {
    console.log('\n🧪 Verifying Onboarding Logic (Dry Run)...');
    try {
        const onboardingService = require('../services/onboarding.service');
        if (onboardingService && onboardingService.onboardBusiness) {
            console.log('✅ Onboarding service found and exportable');
        } else {
            console.error('❌ Onboarding service or method missing');
        }
    } catch (error) {
        console.error('❌ Onboarding logic verification failed:', error.message);
    }
}

async function run() {
    await verifyModels();
    await verifyOnboarding();
    process.exit(0);
}

run();
