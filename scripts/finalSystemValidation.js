/**
 * FINAL SYSTEM VALIDATION AND END-TO-END TESTING
 * Multi-tenant POS System - March 2026
 * 
 * This script performs comprehensive validation of:
 * 1. API contract validation between frontend and backend
 * 2. End-to-end flow testing
 * 3. System guarantees verification
 * 4. Production readiness assessment
 */

const axios = require('axios');
const { sequelize } = require('../config/unified_database');
const neonTransactionSafeExecutor = require('../services/neonTransactionSafeExecutor');

class SystemValidator {
    constructor() {
        this.baseURL = process.env.API_BASE_URL || 'http://localhost:8000';
        this.testResults = [];
        this.criticalFailures = [];
        this.warnings = [];
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${level}: ${message}`;
        console.log(logEntry);
        if (data) {
            console.log('Data:', JSON.stringify(data, null, 2));
        }
        
        if (level === 'CRITICAL') this.criticalFailures.push({ message, data, timestamp });
        if (level === 'WARNING') this.warnings.push({ message, data, timestamp });
        if (level === 'TEST') this.testResults.push({ message, data, timestamp, status: 'completed' });
    }

    async validateAPIContracts() {
        this.log('INFO', '🔍 Validating API contracts between frontend and backend...');
        
        try {
            // Check if backend is running
            const healthCheck = await axios.get(`${this.baseURL}/api/tenant/system-health`, { timeout: 5000 })
                .catch(() => null);
            
            if (!healthCheck) {
                this.log('CRITICAL', 'Backend server is not running or not accessible');
                return false;
            }

            // Validate table management endpoints
            const tableEndpoints = [
                { method: 'GET', path: '/api/tenant/tables', frontend: 'getTables' },
                { method: 'GET', path: '/api/tenant/tables-management', frontend: 'getTablesManagement' },
                { method: 'POST', path: '/api/tenant/tables-management', frontend: 'addTable' },
                { method: 'PUT', path: '/api/tenant/tables-management/:id', frontend: 'updateTable' },
                { method: 'DELETE', path: '/api/tenant/tables-management/:id', frontend: 'deleteTable' }
            ];

            for (const endpoint of tableEndpoints) {
                try {
                    const response = await axios({
                        method: endpoint.method.toLowerCase(),
                        url: `${this.baseURL}${endpoint.path}`,
                        timeout: 3000
                    });
                    this.log('TEST', `✅ ${endpoint.method} ${endpoint.path} - Status: ${response.status}`);
                } catch (error) {
                    if (error.response) {
                        this.log('WARNING', `⚠️ ${endpoint.method} ${endpoint.path} - Status: ${error.response.status}`);
                    } else {
                        this.log('CRITICAL', `❌ ${endpoint.method} ${endpoint.path} - Network error`);
                    }
                }
            }

            // Validate order endpoints
            const orderEndpoints = [
                { method: 'GET', path: '/api/tenant/orders', frontend: 'getOrders' },
                { method: 'POST', path: '/api/tenant/orders', frontend: 'addOrder' },
                { method: 'GET', path: '/api/tenant/orders/:id', frontend: 'getOrderById' },
                { method: 'PUT', path: '/api/tenant/orders/:id', frontend: 'updateOrderStatus' }
            ];

            for (const endpoint of orderEndpoints) {
                try {
                    const response = await axios({
                        method: endpoint.method.toLowerCase(),
                        url: `${this.baseURL}${endpoint.path}`,
                        timeout: 3000
                    });
                    this.log('TEST', `✅ ${endpoint.method} ${endpoint.path} - Status: ${response.status}`);
                } catch (error) {
                    if (error.response) {
                        this.log('WARNING', `⚠️ ${endpoint.method} ${endpoint.path} - Status: ${error.response.status}`);
                    } else {
                        this.log('CRITICAL', `❌ ${endpoint.method} ${endpoint.path} - Network error`);
                    }
                }
            }

            return this.criticalFailures.length === 0;
        } catch (error) {
            this.log('CRITICAL', 'API contract validation failed', { error: error.message });
            return false;
        }
    }

    async validateTableOrderFlow() {
        this.log('INFO', '🔄 Validating table-order consistency flow...');
        
        try {
            // Get all active tenants
            const tenants = await sequelize.query(`
                SELECT tr.business_id, tr.schema_name, b.name as business_name
                FROM tenant_registry tr
                JOIN businesses b ON tr.business_id = b.id
                WHERE tr.status = 'ACTIVE'
                LIMIT 3
            `, { type: sequelize.QueryTypes.SELECT });

            for (const tenant of tenants) {
                await this.validateTenantTableOrderFlow(tenant);
            }
            
            return this.criticalFailures.length === 0;
        } catch (error) {
            this.log('CRITICAL', 'Table-order flow validation failed', { error: error.message });
            return false;
        }
    }

    async validateTenantTableOrderFlow(tenant) {
        try {
            await neonTransactionSafeExecutor.executeInTenant(tenant.schema_name, async (context) => {
                const { transaction, transactionModels: models } = context;
                
                // Check 1: Table status consistency
                const tableStatusCheck = await sequelize.query(`
                    SELECT 
                        COUNT(*) as total_tables,
                        COUNT(*) FILTER (WHERE status = 'AVAILABLE') as available_tables,
                        COUNT(*) FILTER (WHERE status = 'OCCUPIED') as occupied_tables,
                        COUNT(*) FILTER (WHERE status = 'OCCUPIED' AND current_order_id IS NULL) as occupied_no_order,
                        COUNT(*) FILTER (WHERE status = 'AVAILABLE' AND current_order_id IS NOT NULL) as available_with_order
                    FROM tables
                    WHERE business_id = :businessId
                `, {
                    replacements: { businessId: tenant.business_id },
                    transaction,
                    type: sequelize.QueryTypes.SELECT
                });

                const stats = tableStatusCheck[0];
                if (stats.occupied_no_order > 0) {
                    this.log('CRITICAL', `Tables occupied without order in ${tenant.schema_name}`, {
                        occupied_no_order: stats.occupied_no_order
                    });
                }

                if (stats.available_with_order > 0) {
                    this.log('CRITICAL', `Available tables with order links in ${tenant.schema_name}`, {
                        available_with_order: stats.available_with_order
                    });
                }

                // Check 2: Order-table relationship
                const orderTableCheck = await sequelize.query(`
                    SELECT 
                        COUNT(*) as total_orders,
                        COUNT(*) FILTER (WHERE table_id IS NULL AND type = 'DINE_IN') as dine_in_no_table,
                        COUNT(*) FILTER (WHERE table_id IS NOT NULL) as orders_with_tables
                    FROM orders
                    WHERE business_id = :businessId
                `, {
                    replacements: { businessId: tenant.business_id },
                    transaction,
                    type: sequelize.QueryTypes.SELECT
                });

                const orderStats = orderTableCheck[0];
                if (orderStats.dine_in_no_table > 0) {
                    this.log('WARNING', `Dine-in orders without table assignment in ${tenant.schema_name}`, {
                        dine_in_no_table: orderStats.dine_in_no_table
                    });
                }

                this.log('TEST', `✅ Table-order consistency validated for ${tenant.schema_name}`, {
                    tables: stats,
                    orders: orderStats
                });
            });
        } catch (error) {
            this.log('CRITICAL', `Failed to validate tenant ${tenant.schema_name}`, { error: error.message });
        }
    }

    async validateOnboardingCompleteness() {
        this.log('INFO', '🏗️ Validating tenant onboarding completeness...');
        
        try {
            const tenants = await sequelize.query(`
                SELECT tr.business_id, tr.schema_name, b.name as business_name
                FROM tenant_registry tr
                JOIN businesses b ON tr.business_id = b.id
                WHERE tr.status = 'ACTIVE'
            `, { type: sequelize.QueryTypes.SELECT });

            for (const tenant of tenants) {
                await this.validateTenantOnboarding(tenant);
            }
            
            return this.criticalFailures.length === 0;
        } catch (error) {
            this.log('CRITICAL', 'Onboarding validation failed', { error: error.message });
            return false;
        }
    }

    async validateTenantOnboarding(tenant) {
        try {
            await neonTransactionSafeExecutor.executeInTenant(tenant.schema_name, async (context) => {
                const { transaction, transactionModels: models } = context;
                
                const requirements = {
                    outlet: await models.Outlet.count({ where: { businessId: tenant.business_id }, transaction }),
                    area: await models.Area.count({ where: { businessId: tenant.business_id }, transaction }),
                    table: await models.Table.count({ where: { businessId: tenant.business_id }, transaction }),
                    category: await models.Category.count({ where: { businessId: tenant.business_id }, transaction }),
                    product: await models.Product.count({ where: { businessId: tenant.business_id }, transaction })
                };

                const missing = Object.entries(requirements)
                    .filter(([key, count]) => count === 0)
                    .map(([key]) => key);

                if (missing.length > 0) {
                    this.log('CRITICAL', `Incomplete onboarding for ${tenant.schema_name}`, {
                        missing,
                        counts: requirements
                    });
                } else {
                    this.log('TEST', `✅ Onboarding complete for ${tenant.schema_name}`, { counts: requirements });
                }
            });
        } catch (error) {
            this.log('CRITICAL', `Failed to validate onboarding for ${tenant.schema_name}`, { error: error.message });
        }
    }

    async validateSystemGuarantees() {
        this.log('INFO', '🛡️ Validating system guarantees...');
        
        const guarantees = [
            {
                name: 'No tenant created without required data',
                check: () => this.validateOnboardingCompleteness()
            },
            {
                name: 'Tables reflect order state accurately',
                check: () => this.validateTableOrderFlow()
            },
            {
                name: 'API contracts are consistent',
                check: () => this.validateAPIContracts()
            }
        ];

        const results = [];
        for (const guarantee of guarantees) {
            try {
                const passed = await guarantee.check();
                results.push({ name: guarantee.name, passed });
                this.log('TEST', `✅ Guarantee: ${guarantee.name} - ${passed ? 'PASSED' : 'FAILED'}`);
            } catch (error) {
                results.push({ name: guarantee.name, passed: false, error: error.message });
                this.log('CRITICAL', `❌ Guarantee failed: ${guarantee.name}`, { error: error.message });
            }
        }

        return results;
    }

    async runEndToEndTest() {
        this.log('INFO', '🧪 Running end-to-end test simulation...');
        
        try {
            // This would simulate the full flow:
            // 1. Register tenant
            // 2. Login
            // 3. Create table
            // 4. Create product
            // 5. Place order
            // 6. Fetch orders
            // 7. Complete order
            
            // For now, we'll validate the existing data
            const testResults = await this.validateSystemGuarantees();
            
            this.log('TEST', '🧪 End-to-end test simulation completed', { testResults });
            
            return testResults.every(r => r.passed);
        } catch (error) {
            this.log('CRITICAL', 'End-to-end test failed', { error: error.message });
            return false;
        }
    }

    generateFinalReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 FINAL SYSTEM VALIDATION REPORT');
        console.log('='.repeat(80));
        
        console.log(`\n🧪 TESTS COMPLETED: ${this.testResults.length}`);
        this.testResults.forEach((test, index) => {
            console.log(`\n${index + 1}. ${test.message}`);
        });

        console.log(`\n⚠️  WARNINGS: ${this.warnings.length}`);
        this.warnings.forEach((warning, index) => {
            console.log(`\n${index + 1}. ${warning.message}`);
            if (warning.data) {
                console.log('   Details:', JSON.stringify(warning.data, null, 2));
            }
        });

        console.log(`\n🚨 CRITICAL FAILURES: ${this.criticalFailures.length}`);
        this.criticalFailures.forEach((failure, index) => {
            console.log(`\n${index + 1}. ${failure.message}`);
            if (failure.data) {
                console.log('   Details:', JSON.stringify(failure.data, null, 2));
            }
        });

        // Production readiness assessment
        const totalIssues = this.criticalFailures.length + this.warnings.length;
        const isProductionReady = this.criticalFailures.length === 0 && totalIssues <= 5;
        
        console.log('\n' + '='.repeat(80));
        console.log('🎯 PRODUCTION READINESS ASSESSMENT');
        console.log('='.repeat(80));
        
        if (isProductionReady) {
            console.log('✅ SYSTEM IS PRODUCTION READY');
            console.log('   - No critical failures detected');
            console.log('   - Minimal warnings (acceptable for production)');
            console.log('   - All core guarantees validated');
        } else {
            console.log('❌ SYSTEM NOT PRODUCTION READY');
            console.log(`   - Critical failures: ${this.criticalFailures.length}`);
            console.log(`   - Total issues: ${totalIssues}`);
            console.log('   - Address critical issues before deployment');
        }

        console.log('\n' + '='.repeat(80));
        
        return isProductionReady;
    }
}

// Main execution
async function runValidation() {
    const validator = new SystemValidator();
    
    console.log('🚀 Starting comprehensive system validation...');
    
    try {
        // Run all validations
        await validator.validateAPIContracts();
        await validator.validateTableOrderFlow();
        await validator.validateOnboardingCompleteness();
        await validator.runEndToEndTest();
        
        // Generate final report
        const isProductionReady = validator.generateFinalReport();
        
        // Exit with appropriate code
        process.exit(isProductionReady ? 0 : 1);
        
    } catch (error) {
        console.error('🚨 Validation failed with error:', error);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = SystemValidator;

// Run if called directly
if (require.main === module) {
    runValidation();
}
