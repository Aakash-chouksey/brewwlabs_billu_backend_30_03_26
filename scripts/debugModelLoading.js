#!/usr/bin/env node
/**
 * MODEL LOADING DEBUG UTILITY
 * 
 * This script verifies that all models are loading correctly
 * and helps identify why businessId might be missing at runtime.
 */

const path = require('path');

console.log('\n🔍 MODEL LOADING DEBUG UTILITY\n');
console.log('=' .repeat(80));

async function debugModels() {
    try {
        // 1. Load database connection
        console.log('\n1️⃣  Loading database connection...');
        const { controlPlaneSequelize } = require('../config/control_plane_db');
        
        if (!controlPlaneSequelize) {
            console.error('❌ controlPlaneSequelize is undefined!');
            process.exit(1);
        }
        console.log('✅ Database connection loaded');
        
        // 2. Initialize models via ModelFactory
        console.log('\n2️⃣  Initializing models via ModelFactory...');
        const { ModelFactory } = require('../src/architecture/modelFactory');
        
        // Setup model definitions first
        ModelFactory.setupModelDefinitions();
        console.log('✅ Model definitions setup complete');
        
        // Create models on sequelize instance
        const models = await ModelFactory.createModels(controlPlaneSequelize);
        console.log(`✅ Models created: ${Object.keys(models).length} models`);
        
        // 3. Check TenantRegistry specifically
        console.log('\n3️⃣  Checking TenantRegistry model...');
        const TenantRegistry = controlPlaneSequelize.models.TenantRegistry;
        
        if (!TenantRegistry) {
            console.error('❌ TenantRegistry model is NOT registered in sequelize.models');
            console.log('\n   Available models:', Object.keys(controlPlaneSequelize.models).join(', '));
            process.exit(1);
        }
        console.log('✅ TenantRegistry model is registered');
        
        // 4. Check rawAttributes
        console.log('\n4️⃣  Checking TenantRegistry rawAttributes...');
        const rawAttrs = TenantRegistry.rawAttributes || {};
        const attrNames = Object.keys(rawAttrs);
        
        console.log(`   Total attributes: ${attrNames.length}`);
        console.log(`   Attribute names: ${attrNames.join(', ')}`);
        
        // 5. Check for businessId
        console.log('\n5️⃣  Checking for businessId attribute...');
        if (rawAttrs.businessId) {
            console.log('✅ businessId attribute FOUND');
            console.log('   - camelCase name: businessId');
            console.log('   - DB field name:', rawAttrs.businessId.field);
            console.log('   - DataType:', rawAttrs.businessId.type?.key || 'unknown');
            console.log('   - allowNull:', rawAttrs.businessId.allowNull);
        } else {
            console.error('❌ businessId attribute MISSING');
            console.error('   This is the ROOT CAUSE of the auth failure!');
        }
        
        // 6. Check for other critical fields
        console.log('\n6️⃣  Checking other critical fields...');
        const criticalFields = {
            'id': 'UUID primary key',
            'businessId': 'Link to business record',
            'schemaName': 'Tenant schema name',
            'status': 'Tenant status',
            'createdAt': 'Creation timestamp'
        };
        
        for (const [field, description] of Object.entries(criticalFields)) {
            if (rawAttrs[field]) {
                console.log(`   ✅ ${field} - ${description}`);
            } else {
                console.log(`   ❌ ${field} - ${description} - MISSING!`);
            }
        }
        
        // 7. Check model options
        console.log('\n7️⃣  Checking model options...');
        const options = TenantRegistry.options || {};
        console.log('   - tableName:', options.tableName);
        console.log('   - timestamps:', options.timestamps);
        console.log('   - underscored:', options.underscored);
        console.log('   - freezeTableName:', options.freezeTableName);
        console.log('   - schema:', options.schema);
        
        // 8. Check if model file is being loaded correctly
        console.log('\n8️⃣  Checking model file content...');
        const fs = require('fs');
        const modelFilePath = path.join(__dirname, '../control_plane_models/tenantRegistryModel.js');
        
        if (fs.existsSync(modelFilePath)) {
            const content = fs.readFileSync(modelFilePath, 'utf8');
            const hasBusinessId = content.includes('businessId');
            const hasBusinessIdField = content.includes("field: 'business_id'");
            
            console.log('   ✅ Model file exists:', modelFilePath);
            console.log('   ✅ Contains businessId definition:', hasBusinessId);
            console.log('   ✅ Contains field mapping:', hasBusinessIdField);
            
            // Extract businessId definition
            const businessIdMatch = content.match(/businessId:\s*\{[^}]+\}/s);
            if (businessIdMatch) {
                console.log('\n   businessId definition in file:');
                console.log('   ' + businessIdMatch[0].replace(/\n/g, '\n   '));
            }
        } else {
            console.error('❌ Model file NOT found:', modelFilePath);
        }
        
        // 9. Test a simple query
        console.log('\n9️⃣  Testing query generation...');
        try {
            const query = TenantRegistry.findOne({
                where: { businessId: 'test-business-id' },
                attributes: ['status']
            });
            console.log('✅ Query generation successful');
            console.log('   Generated SQL:', query?.sql || 'N/A (not generated yet)');
        } catch (queryError) {
            console.error('❌ Query generation failed:', queryError.message);
        }
        
        // 10. Summary
        console.log('\n' + '='.repeat(80));
        console.log('📊 SUMMARY');
        console.log('='.repeat(80));
        
        if (rawAttrs.businessId) {
            console.log('✅ TenantRegistry model is correctly configured');
            console.log('✅ businessId attribute is present');
            console.log('✅ Auth middleware should work correctly');
        } else {
            console.error('❌ CRITICAL: businessId attribute is MISSING');
            console.error('   Possible causes:');
            console.error('   1. Model file is not being loaded correctly');
            console.error('   2. Model is being overridden by another definition');
            console.error('   3. ModelFactory is not loading the correct file');
            console.error('   4. Cache issue (node_modules or build cache)');
            console.error('\n   🔧 NEXT STEPS:');
            console.error('   1. Check if there are duplicate model files');
            console.error('   2. Delete node_modules and reinstall');
            console.error('   3. Check ModelFactory.setupModelDefinitions() is being called');
            console.error('   4. Verify no circular dependencies in model loading');
        }
        
        // Close connection
        await controlPlaneSequelize.close();
        console.log('\n✅ Debug complete\n');
        
        process.exit(rawAttrs.businessId ? 0 : 1);
        
    } catch (error) {
        console.error('\n💥 Debug script failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

debugModels();
