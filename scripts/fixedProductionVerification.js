#!/usr/bin/env node

/**
 * FIXED PRODUCTION VERIFICATION
 * 
 * Tests the FIXED transaction-safe architecture with proper async context
 * Verifies all critical issues are resolved
 */

const { sequelize } = require('../config/unified_database');
const neonTransactionSafeExecutorFixed = require('../src/services/neonTransactionSafeExecutorFixed');
const globalTransactionEnforcer = require('../src/services/globalTransactionEnforcer');
const asyncTransactionContext = require('../src/services/asyncTransactionContext');

class FixedProductionVerification {
    constructor() {
        this.testResults = {
            transactionEnforcement: { passed: 0, failed: 0, issues: [] },
            concurrencySafety: { passed: 0, failed: 0, issues: [] },
            connectionReuse: { passed: 0, failed: 0, issues: [] },
            rollbackSafety: { passed: 0, failed: 0, issues: [] },
            backgroundJobs: { passed: 0, failed: 0, issues: [] },
            rawQuerySafety: { passed: 0, failed: 0, issues: [] },
            asyncContextPreservation: { passed: 0, failed: 0, issues: [] },
            performanceUnderLoad: { passed: 0, failed: 0, issues: [] }
        };
        
        this.testTenants = [
            'tenant-fixed-1',
            'tenant-fixed-2', 
            'tenant-fixed-3',
            'tenant-fixed-4',
            'tenant-fixed-5'
        ];
    }

    log(category, message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            progress: '🔄',
            fixed: '🔧'
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
     * 1. 🔥 FIXED TRANSACTION ENFORCEMENT
     */
    async testFixedTransactionEnforcement() {
        this.log('TRANSACTION_ENFORCEMENT', 'Testing FIXED transaction enforcement...', 'progress');

        // Test 1: Direct model access should be blocked
        try {
            const User = require('../models/userModel')(sequelize);
            
            try {
                await User.findOne({ where: { email: 'test@test.com' } });
                this.log('TRANSACTION_ENFORCEMENT', '❌ Direct model access still allowed', 'error');
                await this.recordResult('transactionEnforcement', false, 'Direct model access bypasses enforcement');
            } catch (error) {
                if (error.message.includes('transaction') || error.message.includes('ENFORCEMENT')) {
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

        // Test 2: Raw query without context should be blocked
        try {
            await sequelize.query('SELECT 1');
            this.log('TRANSACTION_ENFORCEMENT', '❌ Raw query without context allowed', 'error');
            await this.recordResult('transactionEnforcement', false, 'Raw query bypasses enforcement');
        } catch (error) {
            if (error.message.includes('transaction') || error.message.includes('ENFORCEMENT')) {
                this.log('TRANSACTION_ENFORCEMENT', '✅ Raw query without context properly blocked', 'success');
                await this.recordResult('transactionEnforcement', true);
            } else {
                this.log('TRANSACTION_ENFORCEMENT', `❌ Unexpected error: ${error.message}`, 'error');
                await this.recordResult('transactionEnforcement', false, `Unexpected error: ${error.message}`);
            }
        }

        // Test 3: Fixed executor should work properly
        try {
            const result = await neonTransactionSafeExecutorFixed.executeWithTenant(this.testTenants[0], async (transaction, context) => {
                const [queryResult] = await sequelize.query('SELECT 1 as test', { 
                    transaction,
                    type: sequelize.QueryTypes.SELECT 
                });
                return queryResult.test;
            });

            if (result.success && result.data === 1) {
                this.log('TRANSACTION_ENFORCEMENT', '✅ Fixed executor works correctly', 'success');
                await this.recordResult('transactionEnforcement', true);
            } else {
                this.log('TRANSACTION_ENFORCEMENT', '❌ Fixed executor failed', 'error');
                await this.recordResult('transactionEnforcement', false, 'Fixed executor failed');
            }
        } catch (error) {
            this.log('TRANSACTION_ENFORCEMENT', `❌ Fixed executor error: ${error.message}`, 'error');
            await this.recordResult('transactionEnforcement', false, `Fixed executor error: ${error.message}`);
        }

        // Test 4: Context validation should work
        try {
            const result = await neonTransactionSafeExecutorFixed.executeWithTenant(this.testTenants[0], async (transaction, context) => {
                // Validate context
                globalTransactionEnforcer.validateCurrentContext();
                
                // Test context injection
                const safeQuery = globalTransactionEnforcer.createSafeQueryFunction();
                const [queryResult] = await safeQuery('SELECT current_schema() as schema', {
                    type: sequelize.QueryTypes.SELECT
                });
                
                return queryResult.schema;
            });

            if (result.success && result.data === `tenant_${this.testTenants[0]}`) {
                this.log('TRANSACTION_ENFORCEMENT', '✅ Context validation and injection work', 'success');
                await this.recordResult('transactionEnforcement', true);
            } else {
                this.log('TRANSACTION_ENFORCEMENT', '❌ Context validation failed', 'error');
                await this.recordResult('transactionEnforcement', false, 'Context validation failed');
            }
        } catch (error) {
            this.log('TRANSACTION_ENFORCEMENT', `❌ Context validation error: ${error.message}`, 'error');
            await this.recordResult('transactionEnforcement', false, `Context validation error: ${error.message}`);
        }
    }

    /**
     * 2. 🔐 FIXED CONCURRENCY SAFETY
     */
    async testFixedConcurrencySafety() {
        this.log('CONCURRENCY_SAFETY', 'Testing FIXED concurrency safety with 100+ concurrent requests...', 'progress');

        const concurrentRequests = 100;
        const promises = [];
        const results = [];

        // Create concurrent requests for different tenants
        for (let i = 0; i < concurrentRequests; i++) {
            const tenantId = this.testTenants[i % this.testTenants.length];
            const requestId = `req_${i}`;
            
            promises.push(this.simulateFixedConcurrentRequest(tenantId, requestId));
        }

        try {
            const concurrentResults = await Promise.all(promises);
            
            // Analyze results for cross-tenant data leakage
            const tenantResults = {};
            let crossTenantLeaks = 0;
            let schemaIsolationFailures = 0;
            
            concurrentResults.forEach(result => {
                if (!tenantResults[result.tenantId]) {
                    tenantResults[result.tenantId] = [];
                }
                tenantResults[result.tenantId].push(result);
                
                // Check if data from other tenants leaked
                if (result.success && result.data && result.data.tenantId && result.data.tenantId !== result.tenantId) {
                    crossTenantLeaks++;
                    this.log('CONCURRENCY_SAFETY', `❌ Cross-tenant data leak detected: ${result.tenantId} got data from ${result.data.tenantId}`, 'error');
                }
                
                // Check schema isolation
                if (result.success && result.data && result.data.schema !== `tenant_${result.tenantId}`) {
                    schemaIsolationFailures++;
                    this.log('CONCURRENCY_SAFETY', `❌ Schema isolation failure: expected tenant_${result.tenantId}, got ${result.data.schema}`, 'error');
                }
            });

            const successCount = concurrentResults.filter(r => r.success).length;
            const successRate = (successCount / concurrentRequests * 100).toFixed(1);

            if (crossTenantLeaks === 0 && schemaIsolationFailures === 0 && successRate >= 95) {
                this.log('CONCURRENCY_SAFETY', `✅ Perfect concurrency safety: ${successCount}/${concurrentRequests} successful (${successRate}%)`, 'success');
                await this.recordResult('concurrencySafety', true);
            } else {
                const issues = [];
                if (crossTenantLeaks > 0) issues.push(`${crossTenantLeaks} cross-tenant leaks`);
                if (schemaIsolationFailures > 0) issues.push(`${schemaIsolationFailures} schema isolation failures`);
                if (successRate < 95) issues.push(`Success rate ${successRate}% below 95%`);
                
                this.log('CONCURRENCY_SAFETY', `❌ Concurrency issues: ${issues.join(', ')}`, 'error');
                await this.recordResult('concurrencySafety', false, issues.join(', '));
            }

        } catch (error) {
            this.log('CONCURRENCY_SAFETY', `❌ Concurrency test failed: ${error.message}`, 'error');
            await this.recordResult('concurrencySafety', false, `Concurrency test failed: ${error.message}`);
        }
    }

    async simulateFixedConcurrentRequest(tenantId, requestId) {
        try {
            const result = await neonTransactionSafeExecutorFixed.executeWithTenant(tenantId, async (transaction, context) => {
                // Verify context is preserved
                const currentContext = asyncTransactionContext.getContext();
                
                // Verify schema is set correctly
                const [schemaResult] = await sequelize.query('SELECT current_schema() as schema', {
                    transaction,
                    type: sequelize.QueryTypes.SELECT
                });

                // Simulate some async work to test context preservation
                await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
                
                // Verify context is still preserved after async work
                const contextAfterAsync = asyncTransactionContext.getContext();
                
                return {
                    tenantId,
                    requestId,
                    schema: schemaResult.schema,
                    contextBefore: currentContext,
                    contextAfter: contextAfterAsync,
                    contextPreserved: currentContext.operationId === contextAfterAsync.operationId,
                    timestamp: Date.now()
                };
            }, { requestId });

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
     * 3. ⚠️ FIXED CONNECTION REUSE SAFETY
     */
    async testFixedConnectionReuse() {
        this.log('CONNECTION_REUSE', 'Testing FIXED connection reuse safety...', 'progress');

        try {
            // Test multiple operations on same connection
            const tenantId = this.testTenants[0];
            const operations = [];
            
            for (let i = 0; i < 10; i++) {
                operations.push(async () => {
                    return await neonTransactionSafeExecutorFixed.executeWithTenant(tenantId, async (transaction, context) => {
                        // Check current schema
                        const [schemaResult] = await sequelize.query('SELECT current_schema() as schema', {
                            transaction,
                            type: sequelize.QueryTypes.SELECT
                        });
                        
                        return {
                            operation: i,
                            schema: schemaResult.schema,
                            contextValid: asyncTransactionContext.getContext().operationId === context.operationId
                        };
                    });
                });
            }

            const results = await Promise.all(operations.map(op => op()));
            
            // Verify all operations used correct schema and context
            const schemaFailures = results.filter(r => !r.success || r.data.schema !== `tenant_${tenantId}`);
            const contextFailures = results.filter(r => !r.success || !r.data.contextValid);
            
            if (schemaFailures.length === 0 && contextFailures.length === 0) {
                this.log('CONNECTION_REUSE', '✅ Connection reuse maintains proper schema and context isolation', 'success');
                await this.recordResult('connectionReuse', true);
            } else {
                const issues = [];
                if (schemaFailures.length > 0) issues.push(`${schemaFailures.length} schema failures`);
                if (contextFailures.length > 0) issues.push(`${contextFailures.length} context failures`);
                
                this.log('CONNECTION_REUSE', `❌ Connection reuse issues: ${issues.join(', ')}`, 'error');
                await this.recordResult('connectionReuse', false, issues.join(', '));
            }

        } catch (error) {
            this.log('CONNECTION_REUSE', `❌ Connection reuse test failed: ${error.message}`, 'error');
            await this.recordResult('connectionReuse', false, `Connection reuse test failed: ${error.message}`);
        }
    }

    /**
     * 4. 🔁 FIXED ROLLBACK SAFETY
     */
    async testFixedRollbackSafety() {
        this.log('ROLLBACK_SAFETY', 'Testing FIXED rollback safety...', 'progress');

        try {
            const tenantId = this.testTenants[0];
            
            // Test 1: Intentional error to trigger rollback
            try {
                await neonTransactionSafeExecutorFixed.executeWithTenant(tenantId, async (transaction) => {
                    // Create test table
                    await sequelize.query('CREATE TABLE IF NOT EXISTS rollback_test_fixed (id SERIAL PRIMARY KEY, data TEXT)', {
                        transaction
                    });
                    
                    // Insert data
                    await sequelize.query('INSERT INTO rollback_test_fixed (data) VALUES ($1)', {
                        transaction,
                        replacements: ['before_error']
                    });
                    
                    // Simulate an error
                    throw new Error('Intentional test error for rollback');
                });
                
                this.log('ROLLBACK_SAFETY', '❌ Error should have been thrown and transaction rolled back', 'error');
                await this.recordResult('rollbackSafety', false, 'Error handling failed');
                
            } catch (error) {
                if (error.message.includes('Intentional test error')) {
                    // Check if data was rolled back
                    const checkResult = await neonTransactionSafeExecutorFixed.executeWithTenant(tenantId, async (transaction) => {
                        const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM rollback_test_fixed', {
                            transaction,
                            type: sequelize.QueryTypes.SELECT
                        });
                        return countResult.count;
                    });
                    
                    if (checkResult.success && checkResult.data === 0) {
                        this.log('ROLLBACK_SAFETY', '✅ Fixed rollback worked correctly - no data persisted', 'success');
                        await this.recordResult('rollbackSafety', true);
                    } else {
                        this.log('ROLLBACK_SAFETY', '❌ Fixed rollback failed - data persisted after error', 'error');
                        await this.recordResult('rollbackSafety', false, 'Rollback failed - data persisted');
                    }
                } else {
                    this.log('ROLLBACK_SAFETY', `❌ Unexpected error: ${error.message}`, 'error');
                    await this.recordResult('rollbackSafety', false, `Unexpected error: ${error.message}`);
                }
            }

            // Test 2: Batch operation rollback
            try {
                const batchResult = await neonTransactionSafeExecutorFixed.batchWithTenant(tenantId, [
                    async (transaction) => {
                        await sequelize.query('INSERT INTO rollback_test_fixed (data) VALUES ($1)', {
                            transaction,
                            replacements: ['batch_op_1']
                        });
                    },
                    async (transaction) => {
                        // This will fail
                        throw new Error('Batch operation failure test');
                    },
                    async (transaction) => {
                        await sequelize.query('INSERT INTO rollback_test_fixed (data) VALUES ($1)', {
                            transaction,
                            replacements: ['batch_op_3']
                        });
                    }
                ]);
                
                if (!batchResult.success) {
                    // Check if any data was persisted
                    const checkResult = await neonTransactionSafeExecutorFixed.executeWithTenant(tenantId, async (transaction) => {
                        const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM rollback_test_fixed', {
                            transaction,
                            type: sequelize.QueryTypes.SELECT
                        });
                        return countResult.count;
                    });
                    
                    if (checkResult.success && checkResult.data === 0) {
                        this.log('ROLLBACK_SAFETY', '✅ Fixed batch rollback worked correctly', 'success');
                        await this.recordResult('rollbackSafety', true);
                    } else {
                        this.log('ROLLBACK_SAFETY', '❌ Fixed batch rollback failed - partial data persisted', 'error');
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
     * 5. 🧪 FIXED BACKGROUND JOBS
     */
    async testFixedBackgroundJobs() {
        this.log('BACKGROUND_JOBS', 'Testing FIXED background jobs...', 'progress');

        try {
            // Simulate cron job
            const cronResult = await neonTransactionSafeExecutorFixed.executeBackgroundJob(
                this.testTenants[0], 
                'cron_job_test',
                async (transaction, context) => {
                    // Simulate cron job work
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    const [result] = await sequelize.query('SELECT current_schema() as schema, current_database() as database', {
                        transaction,
                        type: sequelize.QueryTypes.SELECT
                    });
                    
                    return { 
                        type: 'cron_job', 
                        schema: result.schema,
                        database: result.database,
                        contextPreserved: context.isBackgroundJob
                    };
                }
            );

            // Simulate queue worker
            const queueResult = await neonTransactionSafeExecutorFixed.executeBackgroundJob(
                this.testTenants[1], 
                'queue_worker_test',
                async (transaction, context) => {
                    // Simulate queue processing
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    const [result] = await sequelize.query('SELECT current_schema() as schema', {
                        transaction,
                        type: sequelize.QueryTypes.SELECT
                    });
                    
                    return { 
                        type: 'queue_worker', 
                        schema: result.schema,
                        contextPreserved: context.isBackgroundJob
                    };
                }
            );

            // Verify background jobs use transactions correctly
            const cronSafe = cronResult.success && 
                            cronResult.data.schema === `tenant_${this.testTenants[0]}` && 
                            cronResult.data.contextPreserved;
                            
            const queueSafe = queueResult.success && 
                            queueResult.data.schema === `tenant_${this.testTenants[1]}` && 
                            queueResult.data.contextPreserved;

            if (cronSafe && queueSafe) {
                this.log('BACKGROUND_JOBS', '✅ Fixed background jobs use transaction-safe execution with context', 'success');
                await this.recordResult('backgroundJobs', true);
            } else {
                this.log('BACKGROUND_JOBS', '❌ Fixed background jobs not working correctly', 'error');
                await this.recordResult('backgroundJobs', false, 'Background jobs not transaction-safe');
            }

        } catch (error) {
            this.log('BACKGROUND_JOBS', `❌ Background jobs test failed: ${error.message}`, 'error');
            await this.recordResult('backgroundJobs', false, `Background jobs test failed: ${error.message}`);
        }
    }

    /**
     * 6. ⚡ FIXED RAW QUERY SAFETY
     */
    async testFixedRawQuerySafety() {
        this.log('RAW_QUERY_SAFETY', 'Testing FIXED raw query safety...', 'progress');

        try {
            // Test 1: Raw query with proper transaction context
            const safeRawQuery = await neonTransactionSafeExecutorFixed.executeWithTenant(this.testTenants[0], async (transaction, context) => {
                const safeQuery = globalTransactionEnforcer.createSafeQueryFunction();
                const [result] = await safeQuery('SELECT current_schema() as schema, current_database() as database', {
                    type: sequelize.QueryTypes.SELECT
                });
                return result;
            });

            if (safeRawQuery.success && safeRawQuery.data.schema === `tenant_${this.testTenants[0]}`) {
                this.log('RAW_QUERY_SAFETY', '✅ Fixed raw query with transaction context works correctly', 'success');
                await this.recordResult('rawQuerySafety', true);
            } else {
                this.log('RAW_QUERY_SAFETY', '❌ Fixed raw query with transaction context failed', 'error');
                await this.recordResult('rawQuerySafety', false, 'Raw query with transaction context failed');
            }

            // Test 2: Attempt unsafe raw query
            try {
                await sequelize.query('SELECT 1');
                this.log('RAW_QUERY_SAFETY', '❌ Unsafe raw query not blocked', 'error');
                await this.recordResult('rawQuerySafety', false, 'Unsafe raw query not blocked');
            } catch (error) {
                if (error.message.includes('transaction') || error.message.includes('ENFORCEMENT')) {
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
     * 7. 🧠 ASYNC CONTEXT PRESERVATION
     */
    async testAsyncContextPreservation() {
        this.log('ASYNC_CONTEXT', 'Testing async context preservation...', 'progress');

        try {
            const result = await neonTransactionSafeExecutorFixed.executeWithTenant(this.testTenants[0], async (transaction, context) => {
                // Get initial context
                const initialContext = asyncTransactionContext.getContext();
                
                // Test context preservation through async operations
                const asyncResults = await Promise.all([
                    // Async operation 1
                    (async () => {
                        await new Promise(resolve => setTimeout(resolve, 10));
                        const context1 = asyncTransactionContext.getContext();
                        return { id: 1, contextId: context1.operationId, tenantId: context1.tenantId };
                    })(),
                    // Async operation 2
                    (async () => {
                        await new Promise(resolve => setTimeout(resolve, 20));
                        const context2 = asyncTransactionContext.getContext();
                        return { id: 2, contextId: context2.operationId, tenantId: context2.tenantId };
                    })(),
                    // Async operation 3
                    (async () => {
                        await new Promise(resolve => setTimeout(resolve, 5));
                        const context3 = asyncTransactionContext.getContext();
                        return { id: 3, contextId: context3.operationId, tenantId: context3.tenantId };
                    })()
                ]);
                
                // Verify all async operations preserved context
                const contextPreserved = asyncResults.every(result => 
                    result.contextId === initialContext.operationId && 
                    result.tenantId === initialContext.tenantId
                );
                
                return {
                    initialContextId: initialContext.operationId,
                    asyncResults,
                    contextPreserved,
                    preservedCount: asyncResults.filter(r => r.contextId === initialContext.operationId).length
                };
            });

            if (result.success && result.data.contextPreserved) {
                this.log('ASYNC_CONTEXT', `✅ Async context preserved across ${result.data.asyncResults.length} concurrent operations`, 'success');
                await this.recordResult('asyncContextPreservation', true);
            } else {
                this.log('ASYNC_CONTEXT', `❌ Async context preservation failed: ${result.data.preservedCount}/${result.data.asyncResults.length} preserved`, 'error');
                await this.recordResult('asyncContextPreservation', false, 'Async context not preserved');
            }

        } catch (error) {
            this.log('ASYNC_CONTEXT', `❌ Async context test failed: ${error.message}`, 'error');
            await this.recordResult('asyncContextPreservation', false, `Async context test failed: ${error.message}`);
        }
    }

    /**
     * 8. 🚀 PERFORMANCE UNDER LOAD
     */
    async testPerformanceUnderLoad() {
        this.log('PERFORMANCE_UNDER_LOAD', 'Testing FIXED performance under load...', 'progress');

        try {
            const loadTestRequests = 50;
            const startTime = Date.now();
            const promises = [];

            for (let i = 0; i < loadTestRequests; i++) {
                const tenantId = this.testTenants[i % this.testTenants.length];
                promises.push(
                    neonTransactionSafeExecutorFixed.executeWithTenant(tenantId, async (transaction, context) => {
                        // Simulate typical database operations
                        await sequelize.query('SELECT 1 as test', {
                            transaction,
                            type: sequelize.QueryTypes.SELECT
                        });
                        
                        // Simulate some processing
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                        
                        return { tenantId, operation: i, contextId: context.operationId };
                    })
                );
            }

            const results = await Promise.all(promises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / loadTestRequests;
            const successCount = results.filter(r => r.success).length;

            this.log('PERFORMANCE_UNDER_LOAD', `Fixed load test completed: ${successCount}/${loadTestRequests} successful`, 'info');
            this.log('PERFORMANCE_UNDER_LOAD', `Total time: ${totalTime}ms, Average: ${avgTime.toFixed(2)}ms per request`, 'info');

            // Performance thresholds
            const maxAvgTime = 150; // 150ms max average (slightly higher due to context management)
            const minSuccessRate = 0.98; // 98% minimum success rate (higher standard)

            if (avgTime <= maxAvgTime && successCount / loadTestRequests >= minSuccessRate) {
                this.log('PERFORMANCE_UNDER_LOAD', '✅ Fixed performance under load is excellent', 'success');
                await this.recordResult('performanceUnderLoad', true);
            } else {
                const issues = [];
                if (avgTime > maxAvgTime) issues.push(`Average time ${avgTime.toFixed(2)}ms exceeds threshold ${maxAvgTime}ms`);
                if (successCount / loadTestRequests < minSuccessRate) issues.push(`Success rate ${(successCount / loadTestRequests * 100).toFixed(1)}% below threshold ${minSuccessRate * 100}%`);
                
                this.log('PERFORMANCE_UNDER_LOAD', `❌ Performance issues: ${issues.join(', ')}`, 'error');
                await this.recordResult('performanceUnderLoad', false, issues.join(', '));
            }

            // Check stats
            const stats = neonTransactionSafeExecutorFixed.getStats();
            this.log('PERFORMANCE_UNDER_LOAD', `Fixed executor stats: ${JSON.stringify(stats)}`, 'info');

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
        console.log('🔧 FIXED PRODUCTION VERIFICATION REPORT');
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
        const isProductionSafe = criticalPassed === criticalCategories.length && successRate >= 95;
        
        console.log(`\n🎯 FINAL VERDICT:`);
        console.log(`   PRODUCTION SAFE: ${isProductionSafe ? '✅ YES' : '❌ NO'}`);
        console.log(`   OVERALL SCORE: ${successRate}/100`);

        // Specific answers
        console.log(`\n🔥 SPECIFIC ANSWERS:`);
        console.log(`   Can ANY query bypass transaction? ${this.testResults.transactionEnforcement.failed === 0 ? '❌ NO' : '✅ YES'}`);
        console.log(`   Can connection reuse cause leakage? ${this.testResults.connectionReuse.failed === 0 ? '❌ NO' : '✅ YES'}`);
        console.log(`   Are background jobs safe? ${this.testResults.backgroundJobs.failed === 0 ? '✅ YES' : '❌ NO'}`);
        console.log(`   Is system safe under concurrency? ${this.testResults.concurrencySafety.failed === 0 ? '✅ YES' : '❌ NO'}`);
        console.log(`   Is async context preserved? ${this.testResults.asyncContextPreservation.failed === 0 ? '✅ YES' : '❌ NO'}`);
        console.log(`   Is system truly production-ready for Neon? ${isProductionSafe ? '✅ YES' : '❌ NO'}`);

        // Additional stats
        console.log(`\n📈 SYSTEM STATS:`);
        console.log(`   Transaction Enforcement: ${globalTransactionEnforcer.getEnforcementStats()}`);
        console.log(`   Executor Stats: ${JSON.stringify(neonTransactionSafeExecutorFixed.getStats())}`);

        console.log('\n' + '='.repeat(80));

        return {
            productionSafe: isProductionSafe,
            overallScore: parseFloat(successRate),
            totalTests,
            totalPassed,
            totalFailed,
            testResults: this.testResults,
            systemStats: {
                enforcement: globalTransactionEnforcer.getEnforcementStats(),
                executor: neonTransactionSafeExecutorFixed.getStats()
            }
        };
    }

    /**
     * Run all verification tests
     */
    async runFullVerification() {
        console.log('🔧 Starting FIXED PRODUCTION VERIFICATION...');
        console.log('This may take several minutes...\n');

        try {
            await this.testFixedTransactionEnforcement();
            await this.testFixedConcurrencySafety();
            await this.testFixedConnectionReuse();
            await this.testFixedRollbackSafety();
            await this.testFixedBackgroundJobs();
            await this.testFixedRawQuerySafety();
            await this.testAsyncContextPreservation();
            await this.testPerformanceUnderLoad();

            return this.generateFinalReport();

        } catch (error) {
            console.error('💥 Fixed verification failed with error:', error.message);
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
    const verification = new FixedProductionVerification();
    verification.runFullVerification()
        .then(result => {
            if (result.productionSafe) {
                console.log('\n🎉 FIXED SYSTEM IS PRODUCTION READY!');
                process.exit(0);
            } else {
                console.log('\n❌ FIXED SYSTEM STILL HAS ISSUES!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Fixed verification error:', error);
            process.exit(1);
        });
}

module.exports = FixedProductionVerification;
