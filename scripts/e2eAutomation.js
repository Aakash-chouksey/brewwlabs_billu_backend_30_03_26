#!/usr/bin/env node
/**
 * E2E TEST AUTOMATION SYSTEM
 * 
 * Complete end-to-end test flow:
 * 1. Onboarding (create tenant)
 * 2. Login (validate token)
 * 3. Auth middleware test
 * 4. Tenant API tests (dashboard, products, orders)
 * 
 * Features:
 * - Root cause detection for column mismatches
 * - Database verification after onboarding
 * - Comprehensive error reporting
 */

const axios = require('axios');
const { controlPlaneSequelize } = require('../config/control_plane_db');
const { ModelFactory } = require('../src/architecture/modelFactory');

// Configuration
const CONFIG = {
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:8000',
    TEST_EMAIL: `test-${Date.now()}@example.com`,
    TEST_PASSWORD: 'TestPass123!',
    TEST_BUSINESS_NAME: `Test Business ${Date.now()}`,
    TIMEOUT: 30000
};

// Test Results Store
const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
    steps: []
};

/**
 * Root Cause Detection System
 */
class RootCauseDetector {
    static analyzeError(error) {
        const errorMessage = error.message || error.toString();
        
        // Pattern 1: Column does not exist (camelCase vs snake_case mismatch)
        const columnMismatchPattern = /column\s+"?[^"]*\.(\w+)"?\s+does not exist/i;
        const match = errorMessage.match(columnMismatchPattern);
        
        if (match) {
            const fieldName = match[1];
            const snakeCaseEquivalent = this.toSnakeCase(fieldName);
            
            return {
                type: 'COLUMN_MISMATCH',
                severity: 'CRITICAL',
                fieldName,
                snakeCaseEquivalent,
                message: `Model field "${fieldName}" has no DB column mapping`,
                fix: `Add field: '${snakeCaseEquivalent}' to the model attribute "${fieldName}"`,
                example: `${fieldName}: {
    type: DataTypes.UUID,
    field: '${snakeCaseEquivalent}'  // REQUIRED
}`
            };
        }
        
        // Pattern 2: Relation does not exist
        if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
            return {
                type: 'MISSING_TABLE',
                severity: 'CRITICAL',
                message: 'Database table is missing',
                fix: 'Run migrations to create missing tables'
            };
        }
        
        // Pattern 3: Authentication error
        if (errorMessage.includes('auth') || errorMessage.includes('token') || errorMessage.includes('unauthorized')) {
            return {
                type: 'AUTH_ERROR',
                severity: 'HIGH',
                message: 'Authentication failed',
                fix: 'Check credentials and token validity'
            };
        }
        
        return {
            type: 'UNKNOWN',
            severity: 'MEDIUM',
            message: errorMessage,
            fix: 'Manual investigation required'
        };
    }
    
    static toSnakeCase(camelCase) {
        return camelCase.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }
}

/**
 * Test Step Logger
 */
function logStep(step, status, details = null) {
    const timestamp = new Date().toISOString();
    const entry = { step, status, timestamp, details };
    testResults.steps.push(entry);
    testResults.total++;
    
    if (status === 'PASS') {
        testResults.passed++;
        console.log(`✅ [${timestamp}] ${step}`);
    } else if (status === 'FAIL') {
        testResults.failed++;
        console.error(`❌ [${timestamp}] ${step}`);
        if (details) {
            console.error(`   Error: ${details.message || details}`);
        }
    } else {
        console.log(`⏳ [${timestamp}] ${step}`);
    }
    
    return entry;
}

/**
 * Database Verification Functions
 */
class DatabaseVerifier {
    static async verifyTenantRegistry(businessId) {
        const query = `
            SELECT business_id, schema_name, status 
            FROM public.tenant_registry 
            WHERE business_id = :businessId
        `;
        
        const result = await controlPlaneSequelize.query(query, {
            replacements: { businessId },
            type: controlPlaneSequelize.QueryTypes.SELECT
        });
        
        if (result.length === 0) {
            throw new Error('Tenant registry entry not found');
        }
        
        const registry = result[0];
        
        return {
            businessId: registry.business_id,
            schemaName: registry.schema_name,
            status: registry.status,
            isActive: registry.status === 'active'
        };
    }
    
    static async verifyTenantSchema(schemaName) {
        const query = `
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name = :schemaName
        `;
        
        const result = await controlPlaneSequelize.query(query, {
            replacements: { schemaName },
            type: controlPlaneSequelize.QueryTypes.SELECT
        });
        
        return result.length > 0;
    }
    
    static async verifyTenantTables(schemaName) {
        const requiredTables = [
            'products', 'categories', 'orders', 'order_items',
            'customers', 'outlets', 'inventory_items'
        ];
        
        const query = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = :schemaName
        `;
        
        const result = await controlPlaneSequelize.query(query, {
            replacements: { schemaName },
            type: controlPlaneSequelize.QueryTypes.SELECT
        });
        
        const existingTables = result.map(r => r.table_name);
        const missingTables = requiredTables.filter(t => !existingTables.includes(t));
        
        return {
            exists: missingTables.length === 0,
            existingTables,
            missingTables
        };
    }
}

/**
 * E2E Test Suite
 */
class E2ETestSuite {
    constructor() {
        this.token = null;
        this.businessId = null;
        this.schemaName = null;
        this.userId = null;
    }
    
    async initialize() {
        logStep('Initializing database connection', 'PENDING');
        try {
            await ModelFactory.createModels(controlPlaneSequelize);
            logStep('Initializing database connection', 'PASS');
        } catch (error) {
            logStep('Initializing database connection', 'FAIL', RootCauseDetector.analyzeError(error));
            throw error;
        }
    }
    
    async testOnboarding() {
        logStep('Testing Onboarding Flow', 'PENDING');
        
        try {
            const payload = {
                businessName: CONFIG.TEST_BUSINESS_NAME,
                email: CONFIG.TEST_EMAIL,
                password: CONFIG.TEST_PASSWORD,
                phone: '9876543210',
                address: '123 Test Street',
                gstNumber: 'GST123456'
            };
            
            const response = await axios.post(
                `${CONFIG.API_BASE_URL}/api/onboarding`,
                payload,
                { timeout: CONFIG.TIMEOUT }
            );
            
            if (response.data.success) {
                this.businessId = response.data.data?.businessId || response.data.data?.business?.id;
                this.userId = response.data.data?.userId || response.data.data?.user?.id;
                
                logStep('Testing Onboarding Flow', 'PASS', {
                    businessId: this.businessId,
                    userId: this.userId
                });
                
                // Verify database state
                return await this.verifyOnboardingDB();
            } else {
                throw new Error(response.data.message || 'Onboarding failed');
            }
        } catch (error) {
            const analysis = RootCauseDetector.analyzeError(error);
            logStep('Testing Onboarding Flow', 'FAIL', analysis);
            
            if (analysis.type === 'COLUMN_MISMATCH') {
                console.error('\n🚨 ROOT CAUSE DETECTED:');
                console.error(`   Field: ${analysis.fieldName}`);
                console.error(`   Fix: ${analysis.fix}`);
                console.error(`   Example:\n${analysis.example}`);
                process.exit(1);
            }
            
            throw error;
        }
    }
    
    async verifyOnboardingDB() {
        logStep('Verifying Tenant Registry Entry', 'PENDING');
        
        try {
            const registry = await DatabaseVerifier.verifyTenantRegistry(this.businessId);
            this.schemaName = registry.schemaName;
            
            logStep('Verifying Tenant Registry Entry', 'PASS', registry);
            
            // Verify schema exists
            logStep('Verifying Tenant Schema Exists', 'PENDING');
            const schemaExists = await DatabaseVerifier.verifyTenantSchema(this.schemaName);
            
            if (schemaExists) {
                logStep('Verifying Tenant Schema Exists', 'PASS', { schemaName: this.schemaName });
            } else {
                throw new Error(`Schema ${this.schemaName} does not exist`);
            }
            
            // Verify tables exist
            logStep('Verifying Tenant Tables', 'PENDING');
            const tables = await DatabaseVerifier.verifyTenantTables(this.schemaName);
            
            if (tables.exists) {
                logStep('Verifying Tenant Tables', 'PASS', tables);
            } else {
                throw new Error(`Missing tables: ${tables.missingTables.join(', ')}`);
            }
            
            return true;
        } catch (error) {
            logStep('Verifying Tenant Registry Entry', 'FAIL', RootCauseDetector.analyzeError(error));
            throw error;
        }
    }
    
    async testLogin() {
        logStep('Testing Login Flow', 'PENDING');
        
        try {
            const response = await axios.post(
                `${CONFIG.API_BASE_URL}/api/auth/login`,
                {
                    email: CONFIG.TEST_EMAIL,
                    password: CONFIG.TEST_PASSWORD
                },
                { timeout: CONFIG.TIMEOUT }
            );
            
            if (response.data.success && response.data.data?.token) {
                this.token = response.data.data.token;
                logStep('Testing Login Flow', 'PASS', {
                    hasToken: true,
                    tokenLength: this.token.length
                });
                return true;
            } else {
                throw new Error('Login response missing token');
            }
        } catch (error) {
            logStep('Testing Login Flow', 'FAIL', RootCauseDetector.analyzeError(error));
            throw error;
        }
    }
    
    async testAuthMiddleware() {
        logStep('Testing Auth Middleware', 'PENDING');
        
        try {
            const response = await axios.get(
                `${CONFIG.API_BASE_URL}/api/tenant/dashboard`,
                {
                    headers: { Authorization: `Bearer ${this.token}` },
                    timeout: CONFIG.TIMEOUT
                }
            );
            
            if (response.status === 200) {
                logStep('Testing Auth Middleware', 'PASS', {
                    status: response.status,
                    success: response.data.success
                });
                return true;
            } else {
                throw new Error(`Unexpected status: ${response.status}`);
            }
        } catch (error) {
            logStep('Testing Auth Middleware', 'FAIL', RootCauseDetector.analyzeError(error));
            throw error;
        }
    }
    
    async testTenantAPIs() {
        const endpoints = [
            { path: '/api/tenant/dashboard', name: 'Dashboard API' },
            { path: '/api/tenant/products', name: 'Products API' },
            { path: '/api/tenant/orders', name: 'Orders API' },
            { path: '/api/tenant/categories', name: 'Categories API' },
            { path: '/api/tenant/inventory', name: 'Inventory API' }
        ];
        
        const results = [];
        
        for (const endpoint of endpoints) {
            logStep(`Testing ${endpoint.name}`, 'PENDING');
            
            try {
                const response = await axios.get(
                    `${CONFIG.API_BASE_URL}${endpoint.path}`,
                    {
                        headers: { Authorization: `Bearer ${this.token}` },
                        timeout: CONFIG.TIMEOUT
                    }
                );
                
                const result = {
                    name: endpoint.name,
                    status: response.status,
                    success: response.data.success,
                    hasData: response.data.data !== undefined
                };
                
                if (response.data.success) {
                    logStep(`Testing ${endpoint.name}`, 'PASS', result);
                } else {
                    logStep(`Testing ${endpoint.name}`, 'FAIL', result);
                }
                
                results.push(result);
            } catch (error) {
                const analysis = RootCauseDetector.analyzeError(error);
                logStep(`Testing ${endpoint.name}`, 'FAIL', analysis);
                
                if (analysis.type === 'COLUMN_MISMATCH') {
                    console.error(`\n🚨 ROOT CAUSE in ${endpoint.name}:`);
                    console.error(`   Field: ${analysis.fieldName}`);
                    console.error(`   Fix: ${analysis.fix}`);
                }
                
                results.push({
                    name: endpoint.name,
                    error: analysis
                });
            }
        }
        
        return results;
    }
    
    async cleanup() {
        logStep('Cleaning up test data', 'PENDING');
        
        try {
            // Clean up test data from database
            if (this.businessId) {
                await controlPlaneSequelize.query(
                    `DELETE FROM public.tenant_registry WHERE business_id = :businessId`,
                    { replacements: { businessId: this.businessId } }
                );
                
                await controlPlaneSequelize.query(
                    `DELETE FROM public.users WHERE business_id = :businessId`,
                    { replacements: { businessId: this.businessId } }
                );
                
                await controlPlaneSequelize.query(
                    `DELETE FROM public.businesses WHERE id = :businessId`,
                    { replacements: { businessId: this.businessId } }
                );
                
                if (this.schemaName) {
                    await controlPlaneSequelize.query(
                        `DROP SCHEMA IF EXISTS "${this.schemaName}" CASCADE`
                    );
                }
            }
            
            logStep('Cleaning up test data', 'PASS');
        } catch (error) {
            logStep('Cleaning up test data', 'FAIL', error.message);
        }
    }
}

/**
 * Generate Test Report
 */
function generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('                    E2E TEST AUTOMATION REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total Tests: ${testResults.total}`);
    console.log(`   Passed: ${testResults.passed} ✅`);
    console.log(`   Failed: ${testResults.failed} ❌`);
    console.log(`   Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    
    if (testResults.failed > 0) {
        console.log(`\n❌ Failed Tests:`);
        testResults.steps
            .filter(s => s.status === 'FAIL')
            .forEach(s => {
                console.log(`   - ${s.step}`);
                if (s.details?.type === 'COLUMN_MISMATCH') {
                    console.log(`     Issue: ${s.details.message}`);
                    console.log(`     Fix: ${s.details.fix}`);
                }
            });
    }
    
    console.log('\n' + '='.repeat(80));
    
    return testResults.failed === 0;
}

/**
 * Main Execution
 */
async function main() {
    console.log('\n🚀 Starting E2E Test Automation...\n');
    
    const suite = new E2ETestSuite();
    let success = false;
    
    try {
        // Initialize
        await suite.initialize();
        
        // Run tests
        await suite.testOnboarding();
        await suite.testLogin();
        await suite.testAuthMiddleware();
        await suite.testTenantAPIs();
        
        success = true;
    } catch (error) {
        console.error('\n💥 Test suite failed:', error.message);
    } finally {
        await suite.cleanup();
    }
    
    // Generate report
    const allPassed = generateReport();
    
    process.exit(allPassed ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    E2ETestSuite,
    RootCauseDetector,
    DatabaseVerifier,
    testResults
};
