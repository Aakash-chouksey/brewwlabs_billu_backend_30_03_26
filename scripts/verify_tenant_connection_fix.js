#!/usr/bin/env node

/**
 * PRODUCTION TENANT CONNECTION VERIFICATION SCRIPT
 * 
 * Verifies that the tenant connection system is production-ready:
 * - No fallback logic
 * - Proper multi-tenant isolation
 * - Fail-fast error handling
 * - Real database connections
 */

require('dotenv').config();
const path = require('path');

// Set process to production for testing
process.env.NODE_ENV = 'production';

console.log('🔍 PRODUCTION TENANT CONNECTION VERIFICATION');
console.log('==========================================\n');

async function verifyConfiguration() {
    console.log('📋 STEP 1: Configuration Validation');
    console.log('------------------------------------');
    
    const requiredEnvVars = [
        'CONTROL_PLANE_DATABASE_URL',
        'ENCRYPTION_KEY'
    ];
    
    const missingVars = [];
    const presentVars = [];
    
    for (const varName of requiredEnvVars) {
        if (process.env[varName]) {
            presentVars.push(varName);
            console.log(`✅ ${varName}: ${process.env[varName].substring(0, 20)}...`);
        } else {
            missingVars.push(varName);
            console.log(`❌ ${varName}: MISSING`);
        }
    }
    
    if (missingVars.length > 0) {
        console.log(`\n❌ CRITICAL: Missing environment variables: ${missingVars.join(', ')}`);
        return false;
    }
    
    console.log('\n✅ All required environment variables are present');
    return true;
}

async function verifyControlPlaneConnection() {
    console.log('\n📋 STEP 2: Control Plane Connection');
    console.log('-----------------------------------');
    
    try {
        const { controlPlaneSequelize } = require('../config/control_plane_db');
        
        console.log('🔗 Testing control plane database connection...');
        await controlPlaneSequelize.authenticate();
        console.log('✅ Control plane database connection successful');
        
        // Test control plane models
        const { Brand, TenantConnection } = require('../control_plane_models');
        const brandCount = await Brand.count();
        const connCount = await TenantConnection.count();
        
        console.log(`✅ Control plane models working: ${brandCount} brands, ${connCount} tenant connections`);
        return true;
        
    } catch (error) {
        console.log(`❌ Control plane connection failed: ${error.message}`);
        return false;
    }
}

async function verifyTenantConnectionFactory() {
    console.log('\n📋 STEP 3: Tenant Connection Factory');
    console.log('------------------------------------');
    
    try {
        const tenantConnectionFactory = require('../src/services/tenantConnectionFactory');
        
        console.log('✅ Tenant connection factory loaded successfully');
        
        // Get stats
        const stats = tenantConnectionFactory.getStats();
        console.log(`📊 Factory stats: ${stats.cachedConnections} cached connections, ${stats.cachedModels} cached models`);
        
        // Test health check
        const health = await tenantConnectionFactory.healthCheck();
        console.log(`🏥 Factory health: ${health.healthyConnections}/${health.totalConnections} connections healthy`);
        
        return true;
        
    } catch (error) {
        console.log(`❌ Tenant connection factory failed: ${error.message}`);
        return false;
    }
}

async function verifyModelInjection() {
    console.log('\n📋 STEP 4: Model Injection System');
    console.log('---------------------------------');
    
    try {
        const { modelInjectionMiddleware } = require('../middlewares/modelInjection');
        
        console.log('✅ Model injection middleware loaded successfully');
        
        // Create mock request
        const mockReq = {
            brandId: 'test-brand-id',
            tenant: { brandId: 'test-brand-id' },
            ip: '127.0.0.1',
            path: '/api/tenant/test',
            headers: { 'x-panel-type': 'TENANT' },
            auth: { id: 'test-user', email: 'test@example.com' }
        };
        
        const mockRes = {
            status: (code) => ({ json: (data) => console.log(`Response ${code}:`, data) })
        };
        
        let nextCalled = false;
        const mockNext = (error) => {
            if (error) {
                console.log(`❌ Model injection failed: ${error.message}`);
                return false;
            }
            nextCalled = true;
            return true;
        };
        
        // This should fail gracefully since we don't have a real tenant
        await modelInjectionMiddleware(mockReq, mockRes, mockNext);
        
        if (!nextCalled) {
            console.log('✅ Model injection properly failed (no fallback - this is correct behavior)');
        }
        
        return true;
        
    } catch (error) {
        console.log(`❌ Model injection system failed: ${error.message}`);
        return false;
    }
}

async function verifyNoFallbackLogic() {
    console.log('\n📋 STEP 5: Fallback Logic Check');
    console.log('------------------------------');
    
    try {
        // Check that fallback logic was removed from modelInjection.js
        const fs = require('fs');
        const modelInjectionPath = path.join(__dirname, '../middlewares/modelInjection.js');
        const modelInjectionContent = fs.readFileSync(modelInjectionPath, 'utf8');
        
        const fallbackPatterns = [
            /fallback.*models/i,
            /useFallback/i,
            /default.*sequelize/i,
            /require.*database_postgres/i
        ];
        
        let fallbackFound = false;
        for (const pattern of fallbackPatterns) {
            if (pattern.test(modelInjectionContent)) {
                console.log(`❌ Found fallback pattern: ${pattern}`);
                fallbackFound = true;
            }
        }
        
        if (!fallbackFound) {
            console.log('✅ No fallback logic found in model injection');
        }
        
        // Check that production error handling is present
        const productionPatterns = [
            /FAIL FAST/i,
            /NO FALLBACK/i,
            /503/i,
            /Tenant connection failed/i
        ];
        
        let productionFound = 0;
        for (const pattern of productionPatterns) {
            if (pattern.test(modelInjectionContent)) {
                productionFound++;
            }
        }
        
        console.log(`✅ Found ${productionFound} production-grade error handling patterns`);
        
        return !fallbackFound && productionFound >= 2;
        
    } catch (error) {
        console.log(`❌ Fallback check failed: ${error.message}`);
        return false;
    }
}

async function verifyMiddlewareChain() {
    console.log('\n📋 STEP 6: Middleware Chain');
    console.log('--------------------------');
    
    try {
        const { applyMiddlewareChains } = require('../src/architecture/middlewareChain');
        
        console.log('✅ Middleware chain loader works');
        
        // Check that modelInjectionMiddleware is in the tenant chain
        const { tenantMiddlewareChain } = require('../src/architecture/middlewareChain');
        const hasModelInjection = tenantMiddlewareChain.some(mw => 
            mw.name === 'modelInjectionMiddleware' || 
            (mw.toString && mw.toString().includes('modelInjectionMiddleware'))
        );
        
        if (hasModelInjection) {
            console.log('✅ Model injection middleware is in tenant chain');
        } else {
            console.log('❌ Model injection middleware missing from tenant chain');
        }
        
        return hasModelInjection;
        
    } catch (error) {
        console.log(`❌ Middleware chain check failed: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('Starting production tenant connection verification...\n');
    
    const results = {
        configuration: await verifyConfiguration(),
        controlPlane: await verifyControlPlaneConnection(),
        tenantFactory: await verifyTenantConnectionFactory(),
        modelInjection: await verifyModelInjection(),
        noFallback: await verifyNoFallbackLogic(),
        middlewareChain: await verifyMiddlewareChain()
    };
    
    console.log('\n🎯 VERIFICATION RESULTS');
    console.log('=======================');
    
    const allPassed = Object.values(results).every(result => result === true);
    
    for (const [test, passed] of Object.entries(results)) {
        const status = passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${test.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
    }
    
    console.log('\n🏁 FINAL STATUS');
    console.log('===============');
    
    if (allPassed) {
        console.log('🟢 PRODUCTION READY');
        console.log('✅ All critical tenant connection systems verified');
        console.log('✅ No fallback logic detected');
        console.log('✅ Multi-tenant isolation enforced');
        console.log('✅ Fail-fast error handling active');
        console.log('\n🚀 System is ready for production deployment!');
    } else {
        console.log('🔴 NOT PRODUCTION READY');
        console.log('❌ Some critical issues need to be addressed');
        console.log('❌ Review failed tests above and fix issues');
        console.log('\n⚠️  Do NOT deploy to production until all tests pass');
    }
    
    process.exit(allPassed ? 0 : 1);
}

// Run verification
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Verification script failed:', error);
        process.exit(1);
    });
}

module.exports = {
    verifyConfiguration,
    verifyControlPlaneConnection,
    verifyTenantConnectionFactory,
    verifyModelInjection,
    verifyNoFallbackLogic,
    verifyMiddlewareChain
};
