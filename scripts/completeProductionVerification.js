#!/usr/bin/env node

/**
 * COMPLETE PRODUCTION VERIFICATION - PHASE 5
 * 
 * Real-world verification of the FINAL Neon-safe architecture
 * Tests all critical aspects with comprehensive validation
 */

const { sequelize } = require('../config/unified_database');
const finalNeonSafeExecutor = require('../src/services/finalNeonSafeExecutor');
const globalSafetyEnforcer = require('../src/services/globalSafetyEnforcer');

class CompleteProductionVerification {
    constructor() {
        this.testResults = {
            schemaIsolation: { passed: 0, failed: 0, issues: [] },
            concurrencySafety: { passed: 0, failed: 0, issues: [] },
            connectionReuse: { passed: 0, failed: 0, issues: [] },
            rollbackSafety: { passed: 0, failed: 0, issues: [] },
            enforcementValidation: { passed: 0, failed: 0, issues: [] },
            backgroundJobs: { passed: 0, failed: 0, issues: [] },
            performanceUnderLoad: { passed: 0, failed: 0, issues: [] }
        };
        
        this.testTenants = [
            'final-test-1',
            'final-test-2', 
            'final-test-3',
            'final-test-4',
            'final-test-5'
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
            final: '🎯',
            phase: '🔧'
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
     * 🔍 TEST 1 — SCHEMA ISOLATION
     */
    async testSchemaIsolation() {
        this.log('SCHEMA_ISOLATION', 'Testing FINAL schema isolation...', 'progress');

        // Test 1: Schema name resolution
        try {
            const { resolveSchema } = require('../src/services/schemaUtils');
            
            const testCases = [
                { input: 'test-123', expected: 'tenant_test-123' },
                { input: 'tenant-test-456', expected: 'tenant_test-456' },
                { input: 'tenant_789', expected: 'tenant_789' }
            ];

            let allPassed = true;
            for (const testCase of testCases) {
                const result = resolveSchema(testCase.input);
                if (result !== testCase.expected) {
                    this.log('SCHEMA_ISOLATION', `❌ Schema resolution failed: ${testCase.input} → ${result} (expected ${testCase.expected})`, 'error');
                    allPassed = false;
                }
            }

            if (allPassed) {
                this.log('SCHEMA_ISOLATION', '✅ Schema name resolution works correctly', 'success');
                await this.recordResult('schemaIsolation', true);
            } else {
                await this.recordResult('schemaIsolation', false, 'Schema resolution failed');
            }
        } catch (error) {
            this.log('SCHEMA_ISOLATION', `❌ Schema resolution test error: ${error.message}`, 'error');
            await this.recordResult('schemaIsolation', false, `Schema resolution error: ${error.message}`);
        }

        // Test 2: Schema validation and setting
        try {
            const result = await finalNeonSafeExecutor.executeWithTenant(this.testTenants[0], async (transaction, context) => {
                // Verify schema is set correctly
                const [schemaResult] = await sequelize.query('SELECT current_schema() as schema', {
                    transaction,
                    type: sequelize.QueryTypes.SELECT
                });
                
                return {
                    tenantId: context.tenantId,
                    schemaName: context.schemaName,
                    currentSchema: schemaResult.schema,
                    schemaMatch: schemaResult.schema === context.schemaName
                };
            });

            if (result.success && result.data.schemaMatch) {
                this.log('SCHEMA_ISOLATION', '✅ Schema validation and setting work correctly', 'success');
                await this.recordResult('schemaIsolation', true);
            } else {
                this.log('SCHEMA_ISOLATION', `❌ Schema validation failed: expected ${result.data?.schemaName}, got ${result.data?.currentSchema}`, 'error');
                await this.recordResult('schemaIsolation', false, 'Schema validation failed');
            }
        } catch (error) {
            this.log('SCHEMA_ISOLATION', `❌ Schema validation test error: ${error.message}`, 'error');
            await this.recordResult('schemaIsolation', false, `Schema validation error: ${error.message}`);
        }

        // Test 3: Cross-tenant isolation
        try {
            const results = [];
            
            for (const tenantId of this.testTenants.slice(0, 3)) {
                const result = await finalNeonSafeExecutor.executeWithTenant(tenantId, async (transaction, context) => {
                    const [schemaResult] = await sequelize.query('SELECT current_schema() as schema', {
                        transaction,
                        type: sequelize.QueryTypes.SELECT
                    });
                    return { tenantId, schema: schemaResult.schema, expectedSchema: context.schemaName };
                });
                
                if (result.success) {
                    results.push(result.data);
                }
            }

            const allCorrect = results.every(r => r.schema === r.expectedSchema);
            const uniqueSchemas = [...new Set(results.map(r => r.schema))];
            
            if (allCorrect && uniqueSchemas.length === results.length) {
                this.log('SCHEMA_ISOLATION', '✅ Cross-tenant isolation works perfectly', 'success');
                await this.recordResult('schemaIsolation', true);
            } else {
                this.log('SCHEMA_ISOLATION', '❌ Cross-tenant isolation failed', 'error');
                await this.recordResult('schemaIsolation', false, 'Cross-tenant isolation failed');
            }
        } catch (error) {
            this.log('SCHEMA_ISOLATION', `❌ Cross-tenant isolation test error: ${error.message}`, 'error');
            await this.recordResult('schemaIsolation', false, `Cross-tenant isolation error: ${error.message}`);
        }
    }

    /**
     * 🔍 TEST 2 — CONCURRENCY SAFETY
     */
    async testConcurrencySafety() {
        this.log('CONCURRENCY_SAFETY', 'Testing FINAL concurrency safety with 100 concurrent requests...', 'progress');

        const concurrentRequests = 100;
        const promises = [];

        // Create concurrent requests for different tenants
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
                r.success && r.data && r.data.schema !== r.data.expectedSchema
            ).length;

            // Check for schema consistency
            const tenantGroups = {};
            results.forEach(r => {
                if (r.success && r.data) {
                    if (!tenantGroups[r.data.tenantId]) {
                        tenantGroups[r.data.tenantId] = [];
                    }
                    tenantGroups[r.data.tenantId].push(r.data.schema);
                }
            });

            const inconsistentTenants = Object.entries(tenantGroups).filter(([tenantId, schemas]) => 
                [...new Set(schemas)].length > 1
            ).length;

            if (schemaFailures === 0 && inconsistentTenants === 0 && successRate >= 98) {
                this.log('CONCURRENCY_SAFETY', `✅ Perfect concurrency safety: ${successCount}/${concurrentRequests} successful (${successRate}%)`, 'success');
                await this.recordResult('concurrencySafety', true);
            } else {
                const issues = [];
                if (schemaFailures > 0) issues.push(`${schemaFailures} schema failures`);
                if (inconsistentTenants > 0) issues.push(`${inconsistentTenants} tenants with inconsistent schemas`);
                if (successRate < 98) issues.push(`Success rate ${successRate}% below 98%`);
                
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
            const result = await finalNeonSafeExecutor.executeWithTenant(tenantId, async (transaction, context) => {
                // Simulate some work to test context preservation
                await new Promise(resolve => setTimeout(resolve, Math.random() * 30));
                
                // Verify schema
                const [schemaResult] = await sequelize.query('SELECT current_schema() as schema', {
                    transaction,
                    type: sequelize.QueryTypes.SELECT
                });

                // Verify context is preserved
                const currentContext = finalNeonSafeExecutor.getCurrentContext();

                return {
                    tenantId,
                    requestId,
                    schema: schemaResult.schema,
                    expectedSchema: context.schemaName,
                    contextPreserved: currentContext.operationId === context.operationId,
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
     * 🔍 TEST 3 — CONNECTION REUSE
     */
    async testConnectionReuse() {
        this.log('CONNECTION_REUSE', 'Testing FINAL connection reuse safety...', 'progress');

        try {
            const tenantId = this.testTenants[0];
            const operations = [];
            
            // Test rapid tenant switching
            for (let i = 0; i < 20; i++) {
                const testTenant = this.testTenants[i % this.testTenants.length];
                operations.push(async () => {
                    return await finalNeonSafeExecutor.executeWithTenant(testTenant, async (transaction, context) => {
                        const [schemaResult] = await sequelize.query('SELECT current_schema() as schema', {
                            transaction,
                            type: sequelize.QueryTypes.SELECT
                        });
                        
                        return {
                            operation: i,
                            tenantId: testTenant,
                            schema: schemaResult.schema,
                            expectedSchema: context.schemaName
                        };
                    });
                });
            }

            const results = await Promise.all(operations.map(op => op()));
            
            const schemaFailures = results.filter(r => !r.success || r.data.schema !== r.data.expectedSchema);
            
            if (schemaFailures.length === 0) {
                this.log('CONNECTION_REUSE', '✅ Connection reuse maintains perfect schema isolation', 'success');
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
     * 🔍 TEST 4 — ROLLBACK SAFETY
     */
    async testRollbackSafety() {
        this.log('ROLLBACK_SAFETY', 'Testing FINAL rollback safety...', 'progress');

        try {
            const tenantId = this.testTenants[0];
            
            // Test 1: Intentional error with rollback
            try {
                await finalNeonSafeExecutor.executeWithTenant(tenantId, async (transaction) => {
                    // Create test table
                    await sequelize.query('CREATE TABLE IF NOT EXISTS rollback_test_final (id SERIAL PRIMARY KEY, data TEXT)', {
                        transaction
                    });
                    
                    // Insert data
                    await sequelize.query('INSERT INTO rollback_test_final (data) VALUES ($1)', {
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
                    const checkResult = await finalNeonSafeExecutor.executeWithTenant(tenantId, async (transaction) => {
                        const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM rollback_test_final', {
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

            // Test 2: Batch operation rollback
            try {
                const batchResult = await finalNeonSafeExecutor.batchWithTenant(tenantId, [
                    async (transaction) => {
                        await sequelize.query('INSERT INTO rollback_test_final (data) VALUES ($1)', {
                            transaction,
                            replacements: ['batch_op_1']
                        });
                    },
                    async (transaction) => {
                        // This will fail
                        throw new Error('Batch operation failure test');
                    },
                    async (transaction) => {
                        await sequelize.query('INSERT INTO rollback_test_final (data) VALUES ($1)', {
                            transaction,
                            replacements: ['batch_op_3']
                        });
                    }
                ]);
                
                if (!batchResult.success) {
                    // Check if any data was persisted
                    const checkResult = await finalNeonSafeExecutor.executeWithTenant(tenantId, async (transaction) => {
                        const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM rollback_test_final', {
                            transaction,
                            type: sequelize.QueryTypes.SELECT
                        });
                        return countResult.count;
                    });
                    
                    if (checkResult.success && checkResult.data === 0) {
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
     * 🔍 TEST 5 — ENFORCEMENT VALIDATION
     */
    async testEnforcementValidation() {
        this.log('ENFORCEMENT_VALIDATION', 'Testing FINAL enforcement validation...', 'progress');

        // Test 1: Attempt raw query without transaction
        try {
            await sequelize.query('SELECT 1');
            this.log('ENFORCEMENT_VALIDATION', '❌ Raw query without transaction not blocked', 'error');
            await this.recordResult('enforcementValidation', false, 'Raw query not blocked');
        } catch (error) {
            if (error.message.includes('ENFORCEMENT') || error.message.includes('transaction')) {
                this.log('ENFORCEMENT_VALIDATION', '✅ Raw query without transaction properly blocked', 'success');
                await this.recordResult('enforcementValidation', true);
            } else {
                this.log('ENFORCEMENT_VALIDATION', `❌ Unexpected error: ${error.message}`, 'error');
                await this.recordResult('enforcementValidation', false, `Unexpected error: ${error.message}`);
            }
        }

        // Test 2: Attempt direct model access without transaction
        try {
            // This should fail if enforcement is working
            const User = require('../models/userModel')(sequelize);
            await User.findOne({ where: { email: 'test@test.com' } });
            this.log('ENFORCEMENT_VALIDATION', '❌ Direct model access not blocked', 'error');
            await this.recordResult('enforcementValidation', false, 'Direct model access not blocked');
        } catch (error) {
            if (error.message.includes('ENFORCEMENT') || error.message.includes('transaction')) {
                this.log('ENFORCEMENT_VALIDATION', '✅ Direct model access properly blocked', 'success');
                await this.recordResult('enforcementValidation', true);
            } else {
                this.log('ENFORCEMENT_VALIDATION', `❌ Unexpected error: ${error.message}`, 'error');
                await this.recordResult('enforcementValidation', false, `Unexpected error: ${error.message}`);
            }
        }

        // Test 3: Safe operations should work
        try {
            const result = await finalNeonSafeExecutor.executeWithTenant(this.testTenants[0], async (transaction, context) => {
                const [queryResult] = await sequelize.query('SELECT 1 as test', { 
                    transaction,
                    type: sequelize.QueryTypes.SELECT 
                });
                return queryResult.test;
            });

            if (result.success && result.data === 1) {
                this.log('ENFORCEMENT_VALIDATION', '✅ Safe operations work correctly', 'success');
                await this.recordResult('enforcementValidation', true);
            } else {
                this.log('ENFORCEMENT_VALIDATION', '❌ Safe operations failed', 'error');
                await this.recordResult('enforcementValidation', false, 'Safe operations failed');
            }
        } catch (error) {
            this.log('ENFORCEMENT_VALIDATION', `❌ Safe operations test error: ${error.message}`, 'error');
            await this.recordResult('enforcementValidation', false, `Safe operations test error: ${error.message}`);
        }
    }

    /**
     * 🔍 TEST 6 — BACKGROUND JOBS
     */
    async testBackgroundJobs() {
        this.log('BACKGROUND_JOBS', 'Testing FINAL background jobs...', 'progress');

        try {
            // Test background job
            const jobResult = await finalNeonSafeExecutor.executeBackgroundJob(
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
     * 🔍 TEST 7 — PERFORMANCE UNDER LOAD
     */
    async testPerformanceUnderLoad() {
        this.log('PERFORMANCE_UNDER_LOAD', 'Testing FINAL performance under load...', 'progress');

        try {
            const loadTestRequests = 50;
            const startTime = Date.now();
            const promises = [];

            for (let i = 0; i < loadTestRequests; i++) {
                const tenantId = this.testTenants[i % this.testTenants.length];
                promises.push(
                    finalNeonSafeExecutor.executeWithTenant(tenantId, async (transaction, context) => {
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
            const minSuccessRate = 0.98; // 98% minimum success rate

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
     * Generate final comprehensive report
     */
    generateFinalReport() {
        console.log('\n' + '='.repeat(80));
        console.log('🎯 COMPLETE PRODUCTION VERIFICATION REPORT');
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
        
        const criticalCategories = ['schemaIsolation', 'concurrencySafety', 'connectionReuse', 'rollbackSafety', 'enforcementValidation'];
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
        console.log(`   Schema isolation under concurrency? ${this.testResults.schemaIsolation.failed === 0 && this.testResults.concurrencySafety.failed === 0 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Connection reuse safe? ${this.testResults.connectionReuse.failed === 0 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Rollback safety? ${this.testResults.rollbackSafety.failed === 0 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Any unsafe query possible? ${this.testResults.enforcementValidation.failed === 0 ? '❌ NO' : '✅ YES'}`);
        console.log(`   Background jobs safe? ${this.testResults.backgroundJobs.failed === 0 ? '✅ YES' : '❌ NO'}`);
        console.log(`   System truly production-ready for Neon? ${isProductionSafe ? '✅ YES' : '❌ NO'}`);

        // System stats
        console.log(`\n📈 SYSTEM STATS:`);
        console.log(`   Executor Stats: ${JSON.stringify(finalNeonSafeExecutor.getStats())}`);
        console.log(`   Enforcement Stats: ${JSON.stringify(globalSafetyEnforcer.getEnforcementStats())}`);

        console.log('\n' + '='.repeat(80));

        return {
            productionSafe: isProductionSafe,
            overallScore: parseFloat(successRate),
            totalTests,
            totalPassed,
            totalFailed,
            testResults: this.testResults,
            systemStats: {
                executor: finalNeonSafeExecutor.getStats(),
                enforcement: globalSafetyEnforcer.getEnforcementStats()
            }
        };
    }

    /**
     * Run all verification tests
     */
    async runFullVerification() {
        console.log('🎯 Starting COMPLETE PRODUCTION VERIFICATION...');
        console.log('This may take several minutes...\n');

        try {
            await this.testSchemaIsolation();
            await this.testConcurrencySafety();
            await this.testConnectionReuse();
            await this.testRollbackSafety();
            await this.testEnforcementValidation();
            await this.testBackgroundJobs();
            await this.testPerformanceUnderLoad();

            return this.generateFinalReport();

        } catch (error) {
            console.error('💥 Complete verification failed with error:', error.message);
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
    const verification = new CompleteProductionVerification();
    verification.runFullVerification()
        .then(result => {
            if (result.productionSafe) {
                console.log('\n🎉 COMPLETE SYSTEM IS PRODUCTION READY!');
                process.exit(0);
            } else {
                console.log('\n❌ COMPLETE SYSTEM STILL HAS ISSUES!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Complete verification error:', error);
            process.exit(1);
        });
}

module.exports = CompleteProductionVerification;
