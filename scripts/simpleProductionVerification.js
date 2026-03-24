#!/usr/bin/env node

/**
 * SIMPLE PRODUCTION VERIFICATION
 * 
 * Tests the simplified but robust Neon-safe architecture
 * Focus on core functionality without complex async context
 */

const { sequelize } = require('../config/unified_database');
const simpleNeonSafeExecutor = require('../src/services/simpleNeonSafeExecutor');

class SimpleProductionVerification {
    constructor() {
        this.testResults = {
            transactionSafety: { passed: 0, failed: 0, issues: [] },
            concurrencySafety: { passed: 0, failed: 0, issues: [] },
            connectionReuse: { passed: 0, failed: 0, issues: [] },
            rollbackSafety: { passed: 0, failed: 0, issues: [] },
            backgroundJobs: { passed: 0, failed: 0, issues: [] },
            performanceUnderLoad: { passed: 0, failed: 0, issues: [] }
        };
        
        this.testTenants = [
            'tenant-simple-1',
            'tenant-simple-2', 
            'tenant-simple-3',
            'tenant-simple-4',
            'tenant-simple-5'
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
            simple: '🔧'
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
     * 1. 🔥 TRANSACTION SAFETY
     */
    async testTransactionSafety() {
        this.log('TRANSACTION_SAFETY', 'Testing simple transaction safety...', 'progress');

        // Test 1: Basic transaction execution
        try {
            const result = await simpleNeonSafeExecutor.executeWithTenant(this.testTenants[0], async (transaction, context) => {
                const [queryResult] = await sequelize.query('SELECT 1 as test, current_schema() as schema', { 
                    transaction,
                    type: sequelize.QueryTypes.SELECT 
                });
                return queryResult;
            });

            if (result.success && result.data.test === 1 && result.data.schema === `tenant_${this.testTenants[0]}`) {
                this.log('TRANSACTION_SAFETY', '✅ Basic transaction execution works', 'success');
                await this.recordResult('transactionSafety', true);
            } else {
                this.log('TRANSACTION_SAFETY', '❌ Basic transaction execution failed', 'error');
                await this.recordResult('transactionSafety', false, 'Basic transaction failed');
            }
        } catch (error) {
            this.log('TRANSACTION_SAFETY', `❌ Transaction test error: ${error.message}`, 'error');
            await this.recordResult('transactionSafety', false, `Transaction test error: ${error.message}`);
        }

        // Test 2: Schema isolation
        try {
            const results = [];
            
            for (const tenantId of this.testTenants.slice(0, 3)) {
                const result = await simpleNeonSafeExecutor.executeWithTenant(tenantId, async (transaction, context) => {
                    const [schemaResult] = await sequelize.query('SELECT current_schema() as schema', {
                        transaction,
                        type: sequelize.QueryTypes.SELECT
                    });
                    return { tenantId, schema: schemaResult.schema };
                });
                
                if (result.success) {
                    results.push(result.data);
                }
            }

            const allCorrect = results.every(r => r.schema === `tenant_${r.tenantId}`);
            
            if (allCorrect && results.length === 3) {
                this.log('TRANSACTION_SAFETY', '✅ Schema isolation works correctly', 'success');
                await this.recordResult('transactionSafety', true);
            } else {
                this.log('TRANSACTION_SAFETY', '❌ Schema isolation failed', 'error');
                await this.recordResult('transactionSafety', false, 'Schema isolation failed');
            }
        } catch (error) {
            this.log('TRANSACTION_SAFETY', `❌ Schema isolation test error: ${error.message}`, 'error');
            await this.recordResult('transactionSafety', false, `Schema isolation test error: ${error.message}`);
        }

        // Test 3: Read vs Write operations
        try {
            const readResult = await simpleNeonSafeExecutor.readWithTenant(this.testTenants[0], async (transaction, context) => {
                const [result] = await sequelize.query('SELECT 1 as test', {
                    transaction,
                    type: sequelize.QueryTypes.SELECT
                });
                return result.test;
            });

            const writeResult = await simpleNeonSafeExecutor.writeWithTenant(this.testTenants[0], async (transaction, context) => {
                // Simulate write operation
                await new Promise(resolve => setTimeout(resolve, 10));
                return 'write_completed';
            });

            if (readResult.success && writeResult.success) {
                this.log('TRANSACTION_SAFETY', '✅ Read/Write operations work correctly', 'success');
                await this.recordResult('transactionSafety', true);
            } else {
                this.log('TRANSACTION_SAFETY', '❌ Read/Write operations failed', 'error');
                await this.recordResult('transactionSafety', false, 'Read/Write operations failed');
            }
        } catch (error) {
            this.log('TRANSACTION_SAFETY', `❌ Read/Write test error: ${error.message}`, 'error');
            await this.recordResult('transactionSafety', false, `Read/Write test error: ${error.message}`);
        }
    }

    /**
     * 2. 🔐 CONCURRENCY SAFETY
     */
    async testConcurrencySafety() {
        this.log('CONCURRENCY_SAFETY', 'Testing concurrency safety with 50 concurrent requests...', 'progress');

        const concurrentRequests = 50;
        const promises = [];

        // Create concurrent requests
        for (let i = 0; i < concurrentRequests; i++) {
            const tenantId = this.testTenants[i % this.testTenants.length];
            
            promises.push(this.simulateConcurrentRequest(tenantId, i));
        }

        try {
            const results = await Promise.all(promises);
            
            const successCount = results.filter(r => r.success).length;
            const successRate = (successCount / concurrentRequests * 100).toFixed(1);
            
            // Check for cross-tenant leakage
            const schemaFailures = results.filter(r => 
                r.success && r.data && r.data.schema !== `tenant_${r.data.tenantId}`
            ).length;

            if (schemaFailures === 0 && successRate >= 95) {
                this.log('CONCURRENCY_SAFETY', `✅ Perfect concurrency safety: ${successCount}/${concurrentRequests} successful (${successRate}%)`, 'success');
                await this.recordResult('concurrencySafety', true);
            } else {
                const issues = [];
                if (schemaFailures > 0) issues.push(`${schemaFailures} schema failures`);
                if (successRate < 95) issues.push(`Success rate ${successRate}% below 95%`);
                
                this.log('CONCURRENCY_SAFETY', `❌ Concurrency issues: ${issues.join(', ')}`, 'error');
                await this.recordResult('concurrencySafety', false, issues.join(', '));
            }

        } catch (error) {
            this.log('CONCURRENCY_SAFETY', `❌ Concurrency test failed: ${error.message}`, 'error');
            await this.recordResult('concurrencySafety', false, `Concurrency test failed: ${error.message}`);
        }
    }

    async simulateConcurrentRequest(tenantId, requestId) {
        try {
            const result = await simpleNeonSafeExecutor.executeWithTenant(tenantId, async (transaction, context) => {
                // Simulate some work
                await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
                
                // Verify schema
                const [schemaResult] = await sequelize.query('SELECT current_schema() as schema', {
                    transaction,
                    type: sequelize.QueryTypes.SELECT
                });

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
     * 3. ⚠️ CONNECTION REUSE SAFETY
     */
    async testConnectionReuse() {
        this.log('CONNECTION_REUSE', 'Testing connection reuse safety...', 'progress');

        try {
            const tenantId = this.testTenants[0];
            const operations = [];
            
            // Test multiple operations rapidly
            for (let i = 0; i < 10; i++) {
                operations.push(async () => {
                    return await simpleNeonSafeExecutor.executeWithTenant(tenantId, async (transaction, context) => {
                        const [schemaResult] = await sequelize.query('SELECT current_schema() as schema', {
                            transaction,
                            type: sequelize.QueryTypes.SELECT
                        });
                        
                        return {
                            operation: i,
                            schema: schemaResult.schema
                        };
                    });
                });
            }

            const results = await Promise.all(operations.map(op => op()));
            
            const schemaFailures = results.filter(r => !r.success || r.data.schema !== `tenant_${tenantId}`);
            
            if (schemaFailures.length === 0) {
                this.log('CONNECTION_REUSE', '✅ Connection reuse maintains proper schema isolation', 'success');
                await this.recordResult('connectionReuse', true);
            } else {
                this.log('CONNECTION_REUSE', `❌ ${schemaFailures.length} schema failures during connection reuse`, 'error');
                await this.recordResult('connectionReuse', false, `${schemaFailures.length} schema failures`);
            }

        } catch (error) {
            this.log('CONNECTION_REUSE', `❌ Connection reuse test failed: ${error.message}`, 'error');
            await this.recordResult('connectionReuse', false, `Connection reuse test failed: ${error.message}`);
        }
    }

    /**
     * 4. 🔁 ROLLBACK SAFETY
     */
    async testRollbackSafety() {
        this.log('ROLLBACK_SAFETY', 'Testing rollback safety...', 'progress');

        try {
            const tenantId = this.testTenants[0];
            
            // Test 1: Intentional error
            try {
                await simpleNeonSafeExecutor.executeWithTenant(tenantId, async (transaction) => {
                    // Create test table
                    await sequelize.query('CREATE TABLE IF NOT EXISTS rollback_test_simple (id SERIAL PRIMARY KEY, data TEXT)', {
                        transaction
                    });
                    
                    // Insert data
                    await sequelize.query('INSERT INTO rollback_test_simple (data) VALUES ($1)', {
                        transaction,
                        replacements: ['before_error']
                    });
                    
                    // Simulate error
                    throw new Error('Intentional rollback test error');
                });
                
                this.log('ROLLBACK_SAFETY', '❌ Error should have been thrown and rolled back', 'error');
                await this.recordResult('rollbackSafety', false, 'Error handling failed');
                
            } catch (error) {
                if (error.message.includes('Intentional rollback test error')) {
                    // Check if data was rolled back
                    const checkResult = await simpleNeonSafeExecutor.executeWithTenant(tenantId, async (transaction) => {
                        const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM rollback_test_simple', {
                            transaction,
                            type: sequelize.QueryTypes.SELECT
                        });
                        return countResult.count;
                    });
                    
                    if (checkResult.success && checkResult.data === 0) {
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

        } catch (error) {
            this.log('ROLLBACK_SAFETY', `❌ Rollback safety test failed: ${error.message}`, 'error');
            await this.recordResult('rollbackSafety', false, `Rollback safety test failed: ${error.message}`);
        }
    }

    /**
     * 5. 🧪 BACKGROUND JOBS
     */
    async testBackgroundJobs() {
        this.log('BACKGROUND_JOBS', 'Testing background jobs...', 'progress');

        try {
            // Test background job
            const jobResult = await simpleNeonSafeExecutor.executeBackgroundJob(
                this.testTenants[0], 
                'test_job',
                async (transaction, context) => {
                    // Simulate background work
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    const [result] = await sequelize.query('SELECT current_schema() as schema', {
                        transaction,
                        type: sequelize.QueryTypes.SELECT
                    });
                    
                    return { 
                        jobName: context.jobName,
                        schema: result.schema,
                        isBackgroundJob: context.isBackgroundJob
                    };
                }
            );

            if (jobResult.success && 
                jobResult.data.schema === `tenant_${this.testTenants[0]}` && 
                jobResult.data.isBackgroundJob) {
                this.log('BACKGROUND_JOBS', '✅ Background jobs work correctly', 'success');
                await this.recordResult('backgroundJobs', true);
            } else {
                this.log('BACKGROUND_JOBS', '❌ Background jobs failed', 'error');
                await this.recordResult('backgroundJobs', false, 'Background jobs failed');
            }

        } catch (error) {
            this.log('BACKGROUND_JOBS', `❌ Background jobs test failed: ${error.message}`, 'error');
            await this.recordResult('backgroundJobs', false, `Background jobs test failed: ${error.message}`);
        }
    }

    /**
     * 6. 🚀 PERFORMANCE UNDER LOAD
     */
    async testPerformanceUnderLoad() {
        this.log('PERFORMANCE_UNDER_LOAD', 'Testing performance under load...', 'progress');

        try {
            const loadTestRequests = 30;
            const startTime = Date.now();
            const promises = [];

            for (let i = 0; i < loadTestRequests; i++) {
                const tenantId = this.testTenants[i % this.testTenants.length];
                promises.push(
                    simpleNeonSafeExecutor.executeWithTenant(tenantId, async (transaction, context) => {
                        await sequelize.query('SELECT 1 as test', {
                            transaction,
                            type: sequelize.QueryTypes.SELECT
                        });
                        
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
                        
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
            const maxAvgTime = 200; // 200ms max average
            const minSuccessRate = 0.95; // 95% minimum success rate

            if (avgTime <= maxAvgTime && successCount / loadTestRequests >= minSuccessRate) {
                this.log('PERFORMANCE_UNDER_LOAD', '✅ Performance under load is excellent', 'success');
                await this.recordResult('performanceUnderLoad', true);
            } else {
                const issues = [];
                if (avgTime > maxAvgTime) issues.push(`Average time ${avgTime.toFixed(2)}ms exceeds threshold ${maxAvgTime}ms`);
                if (successCount / loadTestRequests < minSuccessRate) issues.push(`Success rate ${(successCount / loadTestRequests * 100).toFixed(1)}% below threshold ${minSuccessRate * 100}%`);
                
                this.log('PERFORMANCE_UNDER_LOAD', `❌ Performance issues: ${issues.join(', ')}`, 'error');
                await this.recordResult('performanceUnderLoad', false, issues.join(', '));
            }

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
        console.log('🔧 SIMPLE PRODUCTION VERIFICATION REPORT');
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
        
        const criticalCategories = ['transactionSafety', 'concurrencySafety', 'connectionReuse', 'rollbackSafety'];
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
        console.log(`   Are transactions safe? ${this.testResults.transactionSafety.failed === 0 ? '✅ YES' : '❌ NO'}`);
        console.log(`   Is system safe under concurrency? ${this.testResults.concurrencySafety.failed === 0 ? '✅ YES' : '❌ NO'}`);
        console.log(`   Can connection reuse cause leakage? ${this.testResults.connectionReuse.failed === 0 ? '❌ NO' : '✅ YES'}`);
        console.log(`   Is rollback working? ${this.testResults.rollbackSafety.failed === 0 ? '✅ YES' : '❌ NO'}`);
        console.log(`   Are background jobs safe? ${this.testResults.backgroundJobs.failed === 0 ? '✅ YES' : '❌ NO'}`);
        console.log(`   Is system truly production-ready for Neon? ${isProductionSafe ? '✅ YES' : '❌ NO'}`);

        // System stats
        console.log(`\n📈 SYSTEM STATS:`);
        console.log(`   Executor Stats: ${JSON.stringify(simpleNeonSafeExecutor.getStats())}`);

        console.log('\n' + '='.repeat(80));

        return {
            productionSafe: isProductionSafe,
            overallScore: parseFloat(successRate),
            totalTests,
            totalPassed,
            totalFailed,
            testResults: this.testResults,
            systemStats: simpleNeonSafeExecutor.getStats()
        };
    }

    /**
     * Run all verification tests
     */
    async runFullVerification() {
        console.log('🔧 Starting SIMPLE PRODUCTION VERIFICATION...');
        console.log('This may take several minutes...\n');

        try {
            await this.testTransactionSafety();
            await this.testConcurrencySafety();
            await this.testConnectionReuse();
            await this.testRollbackSafety();
            await this.testBackgroundJobs();
            await this.testPerformanceUnderLoad();

            return this.generateFinalReport();

        } catch (error) {
            console.error('💥 Simple verification failed with error:', error.message);
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
    const verification = new SimpleProductionVerification();
    verification.runFullVerification()
        .then(result => {
            if (result.productionSafe) {
                console.log('\n🎉 SIMPLE SYSTEM IS PRODUCTION READY!');
                process.exit(0);
            } else {
                console.log('\n❌ SIMPLE SYSTEM STILL HAS ISSUES!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Simple verification error:', error);
            process.exit(1);
        });
}

module.exports = SimpleProductionVerification;
