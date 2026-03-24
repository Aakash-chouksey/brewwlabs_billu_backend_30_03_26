#!/usr/bin/env node

/**
 * REAL-WORLD PRODUCTION VERIFICATION
 * 
 * Comprehensive testing of schema-per-tenant architecture under real-world conditions
 * Tests for transaction safety, concurrency, connection reuse, and edge cases
 */

const { sequelize } = require('../config/unified_database');
const neonTransactionSafeExecutor = require('../src/services/neonTransactionSafeExecutor');
const neonSafeDatabase = require('../src/services/neonSafeDatabase');

// Fix module path issues
try {
    // Try to load the modules
    require('../config/unified_database');
    require('../src/services/neonTransactionSafeExecutor');
} catch (error) {
    console.log('🔧 Fixing module paths...');
    
    // Fix the import in neonTransactionSafeExecutor
    const fs = require('fs');
    const executorPath = '../src/services/neonTransactionSafeExecutor.js';
    
    if (fs.existsSync(executorPath)) {
        let content = fs.readFileSync(executorPath, 'utf8');
        content = content.replace("../config/unified_database", "../../config/unified_database");
        fs.writeFileSync(executorPath, content);
        console.log('✅ Fixed neonTransactionSafeExecutor import path');
    }
}

class RealWorldProductionVerification {
    constructor() {
        this.testResults = {
            transactionEnforcement: { passed: 0, failed: 0, issues: [] },
            concurrencySafety: { passed: 0, failed: 0, issues: [] },
            connectionReuse: { passed: 0, failed: 0, issues: [] },
            rollbackSafety: { passed: 0, failed: 0, issues: [] },
            backgroundJobs: { passed: 0, failed: 0, issues: [] },
            rawQuerySafety: { passed: 0, failed: 0, issues: [] },
            enforcementValidation: { passed: 0, failed: 0, issues: [] },
            performanceUnderLoad: { passed: 0, failed: 0, issues: [] }
        };
        
        this.testTenants = [
            'tenant-test-1',
            'tenant-test-2', 
            'tenant-test-3',
            'tenant-test-4',
            'tenant-test-5'
        ];
    }

    log(category, message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            progress: '🔄'
        }[type] || 'ℹ️';
        
        console.log(`${prefix} [${category}] ${message}`);
    }

    async recordResult(category, passed, issue = null) {
        if (passed) {
            this.testResults[category].passed++;
        } else {
            this.testResults[category].failed++;
            if (issue) {
                this.testResults[category].issues.push(issue);
            }
        }
    }

    /**
     * 1. 🔥 TRANSACTION ENFORCEMENT (ABSOLUTE CHECK)
     */
    async testTransactionEnforcement() {
        this.log('TRANSACTION_ENFORCEMENT', 'Starting absolute transaction enforcement check...', 'progress');

        // Test 1: Attempt direct model access without transaction
        try {
            // This should fail if system is safe
            const User = require('../models/userModel')(sequelize);
            
            // Try to access model directly without transaction
            try {
                await User.findOne({ where: { email: 'test@test.com' } });
                
                // If we reach here, system is NOT safe
                this.log('TRANSACTION_ENFORCEMENT', '❌ CRITICAL: Direct model access allowed without transaction!', 'error');
                await this.recordResult('transactionEnforcement', false, 'Direct model access bypasses transaction enforcement');
                
            } catch (error) {
                if (error.message.includes('transaction') || error.message.includes('Security Violation')) {
                    this.log('TRANSACTION_ENFORCEMENT', '✅ Direct model access properly blocked', 'success');
                    await this.recordResult('transactionEnforcement', true);
                } else {
                    this.log('TRANSACTION_ENFORCEMENT', `❌ Unexpected error: ${error.message}`, 'error');
                    await this.recordResult('transactionEnforcement', false, `Unexpected error: ${error.message}`);
                }
            }
        } catch (error) {
            this.log('TRANSACTION_ENFORCEMENT', `❌ Setup error: ${error.message}`, 'error');
            await this.recordResult('transactionEnforcement', false, `Setup error: ${error.message}`);
        }

        // Test 2: Attempt raw query without transaction
        try {
            try {
                await sequelize.query('SELECT 1');
                
                this.log('TRANSACTION_ENFORCEMENT', '❌ CRITICAL: Raw query allowed without transaction!', 'error');
                await this.recordResult('transactionEnforcement', false, 'Raw query bypasses transaction enforcement');
                
            } catch (error) {
                if (error.message.includes('transaction') || error.message.includes('Security Violation')) {
                    this.log('TRANSACTION_ENFORCEMENT', '✅ Raw query properly blocked', 'success');
                    await this.recordResult('transactionEnforcement', true);
                } else {
                    this.log('TRANSACTION_ENFORCEMENT', `❌ Unexpected error: ${error.message}`, 'error');
                    await this.recordResult('transactionEnforcement', false, `Unexpected error: ${error.message}`);
                }
            }
        } catch (error) {
            this.log('TRANSACTION_ENFORCEMENT', `❌ Raw query test error: ${error.message}`, 'error');
            await this.recordResult('transactionEnforcement', false, `Raw query test error: ${error.message}`);
        }

        // Test 3: Attempt schema switching without transaction
        try {
            try {
                await sequelize.query('SET search_path TO public');
                
                this.log('TRANSACTION_ENFORCEMENT', '❌ CRITICAL: Schema switching allowed without transaction!', 'error');
                await this.recordResult('transactionEnforcement', false, 'Schema switching bypasses transaction enforcement');
                
            } catch (error) {
                if (error.message.includes('transaction') || error.message.includes('Security Violation')) {
                    this.log('TRANSACTION_ENFORCEMENT', '✅ Schema switching properly blocked', 'success');
                    await this.recordResult('transactionEnforcement', true);
                } else {
                    this.log('TRANSACTION_ENFORCEMENT', `❌ Unexpected error: ${error.message}`, 'error');
                    await this.recordResult('transactionEnforcement', false, `Unexpected error: ${error.message}`);
                }
            }
        } catch (error) {
            this.log('TRANSACTION_ENFORCEMENT', `❌ Schema switch test error: ${error.message}`, 'error');
            await this.recordResult('transactionEnforcement', false, `Schema switch test error: ${error.message}`);
        }

        // Test 4: Nested service calls
        try {
            // Simulate nested service calling another service
            const mockNestedCall = async () => {
                // This should also use transaction-safe methods
                return await neonTransactionSafeExecutor.executeWithTenant('test-tenant', async (transaction) => {
                    return await sequelize.query('SELECT 1 as test', { 
                        transaction,
                        type: sequelize.QueryTypes.SELECT 
                    });
                });
            };

            const result = await mockNestedCall();
            
            if (result.success) {
                this.log('TRANSACTION_ENFORCEMENT', '✅ Nested service calls properly use transactions', 'success');
                await this.recordResult('transactionEnforcement', true);
            } else {
                this.log('TRANSACTION_ENFORCEMENT', '❌ Nested service call failed', 'error');
                await this.recordResult('transactionEnforcement', false, 'Nested service call failed');
            }
        } catch (error) {
            this.log('TRANSACTION_ENFORCEMENT', `❌ Nested call test error: ${error.message}`, 'error');
            await this.recordResult('transactionEnforcement', false, `Nested call test error: ${error.message}`);
        }
    }

    /**
     * 2. 🔐 SCHEMA ISOLATION UNDER CONCURRENCY
     */
    async testConcurrencySafety() {
        this.log('CONCURRENCY_SAFETY', 'Starting concurrency safety test with 100+ concurrent requests...', 'progress');

        const concurrentRequests = 100;
        const promises = [];
        const results = [];

        // Create concurrent requests for different tenants
        for (let i = 0; i < concurrentRequests; i++) {
            const tenantId = this.testTenants[i % this.testTenants.length];
            const requestId = `req_${i}`;
            
            promises.push(this.simulateConcurrentRequest(tenantId, requestId));
        }

        try {
            const concurrentResults = await Promise.all(promises);
            
            // Analyze results for cross-tenant data leakage
            const tenantResults = {};
            let crossTenantLeaks = 0;
            
            concurrentResults.forEach(result => {
                if (!tenantResults[result.tenantId]) {
                    tenantResults[result.tenantId] = [];
                }
                tenantResults[result.tenantId].push(result);
                
                // Check if data from other tenants leaked
                if (result.data && result.data.tenantId && result.data.tenantId !== result.tenantId) {
                    crossTenantLeaks++;
                    this.log('CONCURRENCY_SAFETY', `❌ Cross-tenant data leak detected: ${result.tenantId} got data from ${result.data.tenantId}`, 'error');
                }
            });

            if (crossTenantLeaks === 0) {
                this.log('CONCURRENCY_SAFETY', `✅ No cross-tenant data leakage in ${concurrentRequests} concurrent requests`, 'success');
                await this.recordResult('concurrencySafety', true);
            } else {
                this.log('CONCURRENCY_SAFETY', `❌ ${crossTenantLeaks} cross-tenant data leaks detected`, 'error');
                await this.recordResult('concurrencySafety', false, `${crossTenantLeaks} cross-tenant data leaks`);
            }

            // Verify schema isolation per request
            let schemaIsolationFailures = 0;
            concurrentResults.forEach(result => {
                if (result.schema !== `tenant_${result.tenantId}`) {
                    schemaIsolationFailures++;
                    this.log('CONCURRENCY_SAFETY', `❌ Schema isolation failure: expected tenant_${result.tenantId}, got ${result.schema}`, 'error');
                }
            });

            if (schemaIsolationFailures === 0) {
                this.log('CONCURRENCY_SAFETY', '✅ Perfect schema isolation under concurrency', 'success');
                await this.recordResult('concurrencySafety', true);
            } else {
                this.log('CONCURRENCY_SAFETY', `❌ ${schemaIsolationFailures} schema isolation failures`, 'error');
                await this.recordResult('concurrencySafety', false, `${schemaIsolationFailures} schema isolation failures`);
            }

        } catch (error) {
            this.log('CONCURRENCY_SAFETY', `❌ Concurrency test failed: ${error.message}`, 'error');
            await this.recordResult('concurrencySafety', false, `Concurrency test failed: ${error.message}`);
        }
    }

    async simulateConcurrentRequest(tenantId, requestId) {
        try {
            const result = await neonTransactionSafeExecutor.executeWithTenant(tenantId, async (transaction, context) => {
                // Verify schema is set correctly
                const [schemaResult] = await sequelize.query('SELECT current_schema() as schema', {
                    transaction,
                    type: sequelize.QueryTypes.SELECT
                });

                // Simulate some work
                await new Promise(resolve => setTimeout(resolve, Math.random() * 50));

                return {
                    tenantId,
                    requestId,
                    schema: schemaResult.schema,
                    timestamp: Date.now()
                };
            });

            return {
                ...result,
                success: true
            };

        } catch (error) {
            return {
                tenantId,
                requestId,
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 3. ⚠️ CONNECTION REUSE TEST (NEON CRITICAL)
     */
    async testConnectionReuse() {
        this.log('CONNECTION_REUSE', 'Testing connection reuse safety...', 'progress');

        try {
            // Test multiple operations on same connection
            const tenantId = this.testTenants[0];
            const operations = [];
            
            for (let i = 0; i < 10; i++) {
                operations.push(async () => {
                    return await neonTransactionSafeExecutor.executeWithTenant(tenantId, async (transaction) => {
                        // Check current schema
                        const [schemaResult] = await sequelize.query('SELECT current_schema() as schema', {
                            transaction,
                            type: sequelize.QueryTypes.SELECT
                        });
                        
                        return {
                            operation: i,
                            schema: schemaResult.schema,
                            connectionId: transaction.id || 'unknown'
                        };
                    });
                });
            }

            const results = await Promise.all(operations.map(op => op()));
            
            // Verify all operations used correct schema
            const schemaFailures = results.filter(r => r.data.schema !== `tenant_${tenantId}`);
            
            if (schemaFailures.length === 0) {
                this.log('CONNECTION_REUSE', '✅ Connection reuse maintains proper schema isolation', 'success');
                await this.recordResult('connectionReuse', true);
            } else {
                this.log('CONNECTION_REUSE', `❌ ${schemaFailures.length} schema failures during connection reuse`, 'error');
                await this.recordResult('connectionReuse', false, `${schemaFailures.length} schema failures`);
            }

            // Test rapid tenant switching on same connection
            const rapidSwitchResults = [];
            for (let i = 0; i < 20; i++) {
                const rapidTenantId = this.testTenants[i % this.testTenants.length];
                const result = await neonTransactionSafeExecutor.executeWithTenant(rapidTenantId, async (transaction) => {
                    const [schemaResult] = await sequelize.query('SELECT current_schema() as schema', {
                        transaction,
                        type: sequelize.QueryTypes.SELECT
                    });
                    return { tenantId: rapidTenantId, schema: schemaResult.schema };
                });
                rapidSwitchResults.push(result);
            }

            const rapidSwitchFailures = rapidSwitchResults.filter(r => r.data.schema !== `tenant_${r.data.tenantId}`);
            
            if (rapidSwitchFailures.length === 0) {
                this.log('CONNECTION_REUSE', '✅ Rapid tenant switching works correctly', 'success');
                await this.recordResult('connectionReuse', true);
            } else {
                this.log('CONNECTION_REUSE', `❌ ${rapidSwitchFailures.length} failures during rapid switching`, 'error');
                await this.recordResult('connectionReuse', false, `${rapidSwitchFailures.length} rapid switch failures`);
            }

        } catch (error) {
            this.log('CONNECTION_REUSE', `❌ Connection reuse test failed: ${error.message}`, 'error');
            await this.recordResult('connectionReuse', false, `Connection reuse test failed: ${error.message}`);
        }
    }

    /**
     * 4. 🔁 ROLLBACK & FAILURE SAFETY
     */
    async testRollbackSafety() {
        this.log('ROLLBACK_SAFETY', 'Testing rollback and failure safety...', 'progress');

        try {
            const tenantId = this.testTenants[0];
            
            // Test 1: Intentional error to trigger rollback
            try {
                await neonTransactionSafeExecutor.executeWithTenant(tenantId, async (transaction) => {
                    // Insert some data
                    await sequelize.query('CREATE TABLE IF NOT EXISTS rollback_test (id SERIAL PRIMARY KEY, data TEXT)', {
                        transaction
                    });
                    
                    await sequelize.query('INSERT INTO rollback_test (data) VALUES ($1)', {
                        transaction,
                        replacements: ['before_error']
                    });
                    
                    // Simulate an error
                    throw new Error('Intentional test error');
                });
                
                this.log('ROLLBACK_SAFETY', '❌ Error should have been thrown and transaction rolled back', 'error');
                await this.recordResult('rollbackSafety', false, 'Error handling failed');
                
            } catch (error) {
                if (error.message.includes('Intentional test error')) {
                    // Now check if data was rolled back
                    const checkResult = await neonTransactionSafeExecutor.executeWithTenant(tenantId, async (transaction) => {
                        const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM rollback_test', {
                            transaction,
                            type: sequelize.QueryTypes.SELECT
                        });
                        return countResult.count;
                    });
                    
                    if (checkResult.data === 0) {
                        this.log('ROLLBACK_SAFETY', '✅ Rollback worked correctly - no data persisted', 'success');
                        await this.recordResult('rollbackSafety', true);
                    } else {
                        this.log('ROLLBACK_SAFETY', '❌ Rollback failed - data persisted after error', 'error');
                        await this.recordResult('rollbackSafety', false, 'Rollback failed - data persisted');
                    }
                } else {
                    this.log('ROLLBACK_SAFETY', `❌ Unexpected error: ${error.message}`, 'error');
                    await this.recordResult('rollbackSafety', false, `Unexpected error: ${error.message}`);
                }
            }

            // Test 2: Partial failure in batch operation
            try {
                const batchResult = await neonTransactionSafeExecutor.batchWithTenant(tenantId, [
                    async (transaction) => {
                        await sequelize.query('INSERT INTO rollback_test (data) VALUES ($1)', {
                            transaction,
                            replacements: ['batch_op_1']
                        });
                    },
                    async (transaction) => {
                        // This will fail
                        throw new Error('Batch operation failure');
                    },
                    async (transaction) => {
                        await sequelize.query('INSERT INTO rollback_test (data) VALUES ($1)', {
                            transaction,
                            replacements: ['batch_op_3']
                        });
                    }
                ]);
                
                if (!batchResult.success) {
                    // Check if any data was persisted
                    const checkResult = await neonTransactionSafeExecutor.executeWithTenant(tenantId, async (transaction) => {
                        const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM rollback_test', {
                            transaction,
                            type: sequelize.QueryTypes.SELECT
                        });
                        return countResult.count;
                    });
                    
                    if (checkResult.data === 0) {
                        this.log('ROLLBACK_SAFETY', '✅ Batch rollback worked correctly', 'success');
                        await this.recordResult('rollbackSafety', true);
                    } else {
                        this.log('ROLLBACK_SAFETY', '❌ Batch rollback failed - partial data persisted', 'error');
                        await this.recordResult('rollbackSafety', false, 'Batch rollback failed');
                    }
                } else {
                    this.log('ROLLBACK_SAFETY', '❌ Batch operation should have failed', 'error');
                    await this.recordResult('rollbackSafety', false, 'Batch operation should have failed');
                }
            } catch (error) {
                this.log('ROLLBACK_SAFETY', `❌ Batch test error: ${error.message}`, 'error');
                await this.recordResult('rollbackSafety', false, `Batch test error: ${error.message}`);
            }

        } catch (error) {
            this.log('ROLLBACK_SAFETY', `❌ Rollback safety test failed: ${error.message}`, 'error');
            await this.recordResult('rollbackSafety', false, `Rollback safety test failed: ${error.message}`);
        }
    }

    /**
     * 5. 🧪 BACKGROUND JOBS & ASYNC TASKS
     */
    async testBackgroundJobs() {
        this.log('BACKGROUND_JOBS', 'Testing background jobs and async tasks...', 'progress');

        try {
            // Simulate cron job
            const simulateCronJob = async () => {
                return await neonTransactionSafeExecutor.executeWithTenant(this.testTenants[0], async (transaction) => {
                    // Simulate cron job work
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    const [result] = await sequelize.query('SELECT current_schema() as schema', {
                        transaction,
                        type: sequelize.QueryTypes.SELECT
                    });
                    
                    return { type: 'cron_job', schema: result.schema };
                });
            };

            // Simulate queue worker
            const simulateQueueWorker = async () => {
                return await neonTransactionSafeExecutor.executeWithTenant(this.testTenants[1], async (transaction) => {
                    // Simulate queue processing
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    const [result] = await sequelize.query('SELECT current_schema() as schema', {
                        transaction,
                        type: sequelize.QueryTypes.SELECT
                    });
                    
                    return { type: 'queue_worker', schema: result.schema };
                });
            };

            // Run background jobs concurrently
            const [cronResult, queueResult] = await Promise.all([
                simulateCronJob(),
                simulateQueueWorker()
            ]);

            // Verify background jobs use transactions correctly
            const cronSafe = cronResult.success && cronResult.data.schema === `tenant_${this.testTenants[0]}`;
            const queueSafe = queueResult.success && queueResult.data.schema === `tenant_${this.testTenants[1]}`;

            if (cronSafe && queueSafe) {
                this.log('BACKGROUND_JOBS', '✅ Background jobs use transaction-safe execution', 'success');
                await this.recordResult('backgroundJobs', true);
            } else {
                this.log('BACKGROUND_JOBS', '❌ Background jobs not using transaction-safe execution', 'error');
                await this.recordResult('backgroundJobs', false, 'Background jobs not transaction-safe');
            }

        } catch (error) {
            this.log('BACKGROUND_JOBS', `❌ Background jobs test failed: ${error.message}`, 'error');
            await this.recordResult('backgroundJobs', false, `Background jobs test failed: ${error.message}`);
        }
    }

    /**
     * 6. ⚡ RAW QUERY & EDGE CASES
     */
    async testRawQuerySafety() {
        this.log('RAW_QUERY_SAFETY', 'Testing raw query and edge case safety...', 'progress');

        try {
            // Test 1: Raw query with proper transaction
            const safeRawQuery = await neonTransactionSafeExecutor.executeWithTenant(this.testTenants[0], async (transaction) => {
                const [result] = await sequelize.query('SELECT current_schema() as schema, current_database() as database', {
                    transaction,
                    type: sequelize.QueryTypes.SELECT
                });
                return result;
            });

            if (safeRawQuery.success && safeRawQuery.data.schema === `tenant_${this.testTenants[0]}`) {
                this.log('RAW_QUERY_SAFETY', '✅ Raw query with transaction works correctly', 'success');
                await this.recordResult('rawQuerySafety', true);
            } else {
                this.log('RAW_QUERY_SAFETY', '❌ Raw query with transaction failed', 'error');
                await this.recordResult('rawQuerySafety', false, 'Raw query with transaction failed');
            }

            // Test 2: Attempt unsafe raw query
            try {
                await sequelize.query('SELECT 1');
                this.log('RAW_QUERY_SAFETY', '❌ Unsafe raw query not blocked', 'error');
                await this.recordResult('rawQuerySafety', false, 'Unsafe raw query not blocked');
            } catch (error) {
                if (error.message.includes('transaction') || error.message.includes('Security Violation')) {
                    this.log('RAW_QUERY_SAFETY', '✅ Unsafe raw query properly blocked', 'success');
                    await this.recordResult('rawQuerySafety', true);
                } else {
                    this.log('RAW_QUERY_SAFETY', `❌ Unexpected error blocking raw query: ${error.message}`, 'error');
                    await this.recordResult('rawQuerySafety', false, `Unexpected error: ${error.message}`);
                }
            }

        } catch (error) {
            this.log('RAW_QUERY_SAFETY', `❌ Raw query safety test failed: ${error.message}`, 'error');
            await this.recordResult('rawQuerySafety', false, `Raw query safety test failed: ${error.message}`);
        }
    }

    /**
     * 7. 🧠 ENFORCEMENT VALIDATION
     */
    async testEnforcementValidation() {
        this.log('ENFORCEMENT_VALIDATION', 'Testing enforcement validation...', 'progress');

        try {
            // Test that the system enforces transaction usage
            const enforcementTests = [
                // Test direct model access
                async () => {
                    const User = require('../models/userModel')(sequelize);
                    return await User.findOne({ where: { email: 'test@test.com' } });
                },
                // Test direct sequelize.query
                async () => {
                    return await sequelize.query('SELECT 1');
                },
                // Test schema switching
                async () => {
                    return await sequelize.query('SET search_path TO public');
                }
            ];

            let blockedCount = 0;
            
            for (let i = 0; i < enforcementTests.length; i++) {
                try {
                    await enforcementTests[i]();
                    this.log('ENFORCEMENT_VALIDATION', `❌ Enforcement test ${i + 1} not blocked`, 'error');
                } catch (error) {
                    if (error.message.includes('transaction') || error.message.includes('Security Violation')) {
                        blockedCount++;
                        this.log('ENFORCEMENT_VALIDATION', `✅ Enforcement test ${i + 1} properly blocked`, 'success');
                    } else {
                        this.log('ENFORCEMENT_VALIDATION', `❌ Enforcement test ${i + 1} unexpected error: ${error.message}`, 'error');
                    }
                }
            }

            if (blockedCount === enforcementTests.length) {
                this.log('ENFORCEMENT_VALIDATION', '✅ All enforcement tests properly blocked unsafe operations', 'success');
                await this.recordResult('enforcementValidation', true);
            } else {
                this.log('ENFORCEMENT_VALIDATION', `❌ Only ${blockedCount}/${enforcementTests.length} operations properly blocked`, 'error');
                await this.recordResult('enforcementValidation', false, `Incomplete enforcement: ${blockedCount}/${enforcementTests.length}`);
            }

        } catch (error) {
            this.log('ENFORCEMENT_VALIDATION', `❌ Enforcement validation test failed: ${error.message}`, 'error');
            await this.recordResult('enforcementValidation', false, `Enforcement validation failed: ${error.message}`);
        }
    }

    /**
     * 8. 🚀 PERFORMANCE UNDER LOAD
     */
    async testPerformanceUnderLoad() {
        this.log('PERFORMANCE_UNDER_LOAD', 'Testing performance under load...', 'progress');

        try {
            const loadTestRequests = 50;
            const startTime = Date.now();
            const promises = [];

            for (let i = 0; i < loadTestRequests; i++) {
                const tenantId = this.testTenants[i % this.testTenants.length];
                promises.push(
                    neonTransactionSafeExecutor.executeWithTenant(tenantId, async (transaction) => {
                        // Simulate typical database operations
                        await sequelize.query('SELECT 1 as test', {
                            transaction,
                            type: sequelize.QueryTypes.SELECT
                        });
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
                        return { tenantId, operation: i };
                    })
                );
            }

            const results = await Promise.all(promises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / loadTestRequests;
            const successCount = results.filter(r => r.success).length;

            this.log('PERFORMANCE_UNDER_LOAD', `Load test completed: ${successCount}/${loadTestRequests} successful`, 'info');
            this.log('PERFORMANCE_UNDER_LOAD', `Total time: ${totalTime}ms, Average: ${avgTime.toFixed(2)}ms per request`, 'info');

            // Performance thresholds
            const maxAvgTime = 100; // 100ms max average
            const minSuccessRate = 0.95; // 95% minimum success rate

            if (avgTime <= maxAvgTime && successCount / loadTestRequests >= minSuccessRate) {
                this.log('PERFORMANCE_UNDER_LOAD', '✅ Performance under load is acceptable', 'success');
                await this.recordResult('performanceUnderLoad', true);
            } else {
                const issues = [];
                if (avgTime > maxAvgTime) issues.push(`Average time ${avgTime.toFixed(2)}ms exceeds threshold ${maxAvgTime}ms`);
                if (successCount / loadTestRequests < minSuccessRate) issues.push(`Success rate ${(successCount / loadTestRequests * 100).toFixed(1)}% below threshold ${minSuccessRate * 100}%`);
                
                this.log('PERFORMANCE_UNDER_LOAD', `❌ Performance issues: ${issues.join(', ')}`, 'error');
                await this.recordResult('performanceUnderLoad', false, issues.join(', '));
            }

            // Check connection pool behavior
            const stats = neonTransactionSafeExecutor.getTransactionStats();
            this.log('PERFORMANCE_UNDER_LOAD', `Connection pool stats: ${JSON.stringify(stats)}`, 'info');

        } catch (error) {
            this.log('PERFORMANCE_UNDER_LOAD', `❌ Performance test failed: ${error.message}`, 'error');
            await this.recordResult('performanceUnderLoad', false, `Performance test failed: ${error.message}`);
        }
    }

    /**
     * Generate final report
     */
    generateFinalReport() {
        console.log('\n' + '='.repeat(80));
        console.log('🎯 REAL-WORLD PRODUCTION VERIFICATION REPORT');
        console.log('='.repeat(80));

        const totalTests = Object.values(this.testResults).reduce((sum, cat) => sum + cat.passed + cat.failed, 0);
        const totalPassed = Object.values(this.testResults).reduce((sum, cat) => sum + cat.passed, 0);
        const totalFailed = Object.values(this.testResults).reduce((sum, cat) => sum + cat.failed, 0);
        const successRate = totalTests > 0 ? (totalPassed / totalTests * 100).toFixed(1) : 0;

        console.log(`\n📊 OVERALL RESULTS:`);
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Passed: ${totalPassed}`);
        console.log(`   Failed: ${totalFailed}`);
        console.log(`   Success Rate: ${successRate}%`);

        console.log(`\n🔍 DETAILED RESULTS:`);
        Object.entries(this.testResults).forEach(([category, results]) => {
            const categorySuccessRate = results.passed + results.failed > 0 
                ? (results.passed / (results.passed + results.failed) * 100).toFixed(1)
                : 0;
            
            console.log(`\n   ${category}:`);
            console.log(`     Passed: ${results.passed}`);
            console.log(`     Failed: ${results.failed}`);
            console.log(`     Success Rate: ${categorySuccessRate}%`);
            
            if (results.issues.length > 0) {
                console.log(`     Issues:`);
                results.issues.forEach(issue => {
                    console.log(`       - ${issue}`);
                });
            }
        });

        // Critical assessment
        console.log(`\n🚨 CRITICAL ASSESSMENT:`);
        
        const criticalCategories = ['transactionEnforcement', 'concurrencySafety', 'connectionReuse', 'rollbackSafety'];
        const criticalPassed = criticalCategories.filter(cat => this.testResults[cat].failed === 0).length;
        
        if (criticalPassed === criticalCategories.length) {
            console.log(`   ✅ ALL CRITICAL SAFETY TESTS PASSED`);
        } else {
            console.log(`   ❌ ${criticalCategories.length - criticalPassed} CRITICAL SAFETY TESTS FAILED`);
        }

        // Final verdict
        const isProductionSafe = criticalPassed === criticalCategories.length && successRate >= 90;
        
        console.log(`\n🎯 FINAL VERDICT:`);
        console.log(`   PRODUCTION SAFE: ${isProductionSafe ? '✅ YES' : '❌ NO'}`);
        console.log(`   OVERALL SCORE: ${successRate}/100`);

        // Specific answers
        console.log(`\n🔥 SPECIFIC ANSWERS:`);
        console.log(`   Can ANY query bypass transaction? ${this.testResults.transactionEnforcement.failed === 0 ? '❌ NO' : '✅ YES'}`);
        console.log(`   Can connection reuse cause leakage? ${this.testResults.connectionReuse.failed === 0 ? '❌ NO' : '✅ YES'}`);
        console.log(`   Are background jobs safe? ${this.testResults.backgroundJobs.failed === 0 ? '✅ YES' : '❌ NO'}`);
        console.log(`   Is system safe under concurrency? ${this.testResults.concurrencySafety.failed === 0 ? '✅ YES' : '❌ NO'}`);
        console.log(`   Is system truly production-ready for Neon? ${isProductionSafe ? '✅ YES' : '❌ NO'}`);

        console.log('\n' + '='.repeat(80));

        return {
            productionSafe: isProductionSafe,
            overallScore: parseFloat(successRate),
            totalTests,
            totalPassed,
            totalFailed,
            testResults: this.testResults
        };
    }

    /**
     * Run all verification tests
     */
    async runFullVerification() {
        console.log('🚀 Starting REAL-WORLD PRODUCTION VERIFICATION...');
        console.log('This may take several minutes...\n');

        try {
            await this.testTransactionEnforcement();
            await this.testConcurrencySafety();
            await this.testConnectionReuse();
            await this.testRollbackSafety();
            await this.testBackgroundJobs();
            await this.testRawQuerySafety();
            await this.testEnforcementValidation();
            await this.testPerformanceUnderLoad();

            return this.generateFinalReport();

        } catch (error) {
            console.error('💥 Verification failed with error:', error.message);
            return {
                productionSafe: false,
                error: error.message,
                testResults: this.testResults
            };
        }
    }
}

// Run verification if called directly
if (require.main === module) {
    const verification = new RealWorldProductionVerification();
    verification.runFullVerification()
        .then(result => {
            if (result.productionSafe) {
                console.log('\n🎉 SYSTEM IS PRODUCTION READY!');
                process.exit(0);
            } else {
                console.log('\n❌ SYSTEM IS NOT PRODUCTION READY!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Verification error:', error);
            process.exit(1);
        });
}

module.exports = RealWorldProductionVerification;
