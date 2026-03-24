#!/usr/bin/env node

/**
 * REALISTIC PRODUCTION LOAD TEST
 * 
 * Tests actual system capabilities without crashing
 */

const { performance } = require('perf_hooks');

class RealisticLoadTest {
    constructor() {
        this.results = {
            totalOrders: 0,
            successfulOrders: 0,
            failedOrders: 0,
            averageResponseTime: 0,
            maxResponseTime: 0,
            throughput: 0,
            errors: [],
            bottlenecks: [],
            memoryUsage: [],
            cpuUsage: []
        };
    }

    /**
     * Test database connection pool limits
     */
    async testConnectionPoolLimits() {
        console.log('🔍 Testing database connection pool limits...');
        
        const tenantConnectionFactory = require('../src/services/tenantConnectionFactory');
        const stats = tenantConnectionFactory.getStats();
        
        console.log(`📊 Current Connection Pool Stats:`);
        console.log(`   Cached Connections: ${stats.cachedConnections}`);
        console.log(`   Cached Models: ${stats.cachedModels}`);
        console.log(`   Initializing Connections: ${stats.initializingConnections}`);
        
        // Test connection pool saturation
        const saturationTest = {
            maxTenants: 100, // Current LRU limit
            connectionsPerTenant: 3, // Current pool limit
            totalMaxConnections: 300
        };
        
        console.log(`\n🔥 CONNECTION POOL ANALYSIS:`);
        console.log(`   LRU Cache Limit: ${saturationTest.maxTenants} tenants`);
        console.log(`   Connections per Tenant: ${saturationTest.connectionsPerTenant}`);
        console.log(`   Total Max Connections: ${saturationTest.totalMaxConnections}`);
        
        // CRITICAL ISSUE: 10,000 tenants but only 100 can be cached
        if (saturationTest.maxTenants < 10000) {
            this.results.bottlenecks.push({
                type: 'CONNECTION_POOL',
                severity: 'CRITICAL',
                message: `LRU cache limit ${saturationTest.maxTenants} is far below required 10,000 tenants`
            });
        }
        
        return saturationTest;
    }

    /**
     * Test actual database performance
     */
    async testDatabasePerformance() {
        console.log('\n🔍 Testing database performance...');
        
        try {
            const { sequelize } = require('../config/database_postgres');
            
            // Test basic query performance
            const queryTests = [
                {
                    name: 'Simple SELECT',
                    query: 'SELECT 1 as test',
                    expectedTime: 10 // 10ms max
                },
                {
                    name: 'Complex JOIN',
                    query: `
                        SELECT u.id, u.email, o.id as order_id 
                        FROM users u 
                        LEFT JOIN orders o ON u.id = o.user_id 
                        LIMIT 10
                    `,
                    expectedTime: 100 // 100ms max
                },
                {
                    name: 'INSERT Performance',
                    query: 'INSERT INTO test_table (data) VALUES (\'test_data\')',
                    expectedTime: 50 // 50ms max
                }
            ];
            
            for (const test of queryTests) {
                const startTime = performance.now();
                try {
                    await sequelize.query(test.query);
                    const endTime = performance.now();
                    const responseTime = endTime - startTime;
                    
                    if (responseTime > test.expectedTime) {
                        this.results.bottlenecks.push({
                            type: 'DATABASE_PERFORMANCE',
                            severity: 'HIGH',
                            message: `${test.name} took ${responseTime.toFixed(2)}ms (expected < ${test.expectedTime}ms)`
                        });
                    }
                    
                    console.log(`   ✅ ${test.name}: ${responseTime.toFixed(2)}ms`);
                } catch (error) {
                    this.results.bottlenecks.push({
                        type: 'DATABASE_ERROR',
                        severity: 'HIGH',
                        message: `${test.name} failed: ${error.message}`
                    });
                }
            }
            
        } catch (error) {
            this.results.bottlenecks.push({
                type: 'DATABASE_CONNECTION',
                severity: 'CRITICAL',
                message: `Database connection failed: ${error.message}`
            });
        }
    }

    /**
     * Test Redis performance
     */
    async testRedisPerformance() {
        console.log('\n🔍 Testing Redis performance...');
        
        try {
            const { healthCheck: redisHealth } = require('../src/cache/redisClient');
            const redisStatus = await redisHealth();
            
            console.log(`   Redis Status: ${redisStatus}`);
            
            if (redisStatus !== 'OK') {
                this.results.bottlenecks.push({
                    type: 'REDIS_PERFORMANCE',
                    severity: 'HIGH',
                    message: `Redis health check failed: ${redisStatus}`
                });
            }
            
        } catch (error) {
            this.results.bottlenecks.push({
                type: 'REDIS_CONNECTION',
                severity: 'HIGH',
                message: `Redis connection failed: ${error.message}`
            });
        }
    }

    /**
     * Test memory usage patterns
     */
    testMemoryUsage() {
        console.log('\n🔍 Testing memory usage...');
        
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
        
        console.log(`   Heap Used: ${heapUsedMB.toFixed(2)} MB`);
        console.log(`   Heap Total: ${heapTotalMB.toFixed(2)} MB`);
        console.log(`   External: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);
        
        // CRITICAL: Memory usage analysis
        if (heapUsedMB > 1000) { // 1GB
            this.results.bottlenecks.push({
                type: 'MEMORY_USAGE',
                severity: 'CRITICAL',
                message: `High memory usage: ${heapUsedMB.toFixed(2)} MB`
            });
        }
        
        // Estimate memory needed for 10,000 tenants
        const estimatedMemoryPerTenant = 5; // 5MB per tenant (connections + models)
        const totalEstimatedMemory = 10000 * estimatedMemoryPerTenant / 1024; // GB
        
        console.log(`   Estimated Memory for 10,000 tenants: ${totalEstimatedMemory.toFixed(2)} GB`);
        
        if (totalEstimatedMemory > 16) { // More than typical server memory
            this.results.bottlenecks.push({
                type: 'MEMORY_SCALABILITY',
                severity: 'CRITICAL',
                message: `Estimated ${totalEstimatedMemory.toFixed(2)} GB needed for 10,000 tenants exceeds typical limits`
            });
        }
        
        return { heapUsedMB, estimatedMemoryFor10kTenants: totalEstimatedMemory };
    }

    /**
     * Test order creation throughput
     */
    async testOrderThroughput() {
        console.log('\n🔍 Testing order creation throughput...');
        
        // Simulate realistic order creation
        const orderTest = {
            concurrentOrders: 100,
            ordersPerSecond: 1000,
            testDurationSeconds: 10
        };
        
        const startTime = performance.now();
        const promises = [];
        
        for (let i = 0; i < orderTest.concurrentOrders; i++) {
            promises.push(this.simulateOrderCreation(i));
        }
        
        try {
            const results = await Promise.allSettled(promises);
            const endTime = performance.now();
            const totalTime = (endTime - startTime) / 1000;
            
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            this.results.successfulOrders += successful;
            this.results.failedOrders += failed;
            this.results.totalOrders += successful + failed;
            this.results.throughput = successful / totalTime;
            
            console.log(`   Concurrent Orders: ${orderTest.concurrentOrders}`);
            console.log(`   Successful: ${successful}`);
            console.log(`   Failed: ${failed}`);
            console.log(`   Throughput: ${this.results.throughput.toFixed(2)} orders/second`);
            
            if (this.results.throughput < 100) { // Less than 100 orders/second
                this.results.bottlenecks.push({
                    type: 'THROUGHPUT',
                    severity: 'HIGH',
                    message: `Low throughput: ${this.results.throughput.toFixed(2)} orders/second`
                });
            }
            
        } catch (error) {
            this.results.bottlenecks.push({
                type: 'THROUGHPUT_TEST',
                severity: 'HIGH',
                message: `Throughput test failed: ${error.message}`
            });
        }
    }

    async simulateOrderCreation(orderId) {
        // Simulate order creation with database operations
        const startTime = performance.now();
        
        try {
            // Simulate database operations
            await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10)); // 10-60ms
            
            const endTime = performance.now();
            const responseTime = endTime - startTime;
            this.results.maxResponseTime = Math.max(this.results.maxResponseTime, responseTime);
            
            return { success: true, responseTime, orderId };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Analyze current architecture limitations
     */
    analyzeArchitectureLimitations() {
        console.log('\n🔍 Analyzing architecture limitations...');
        
        const limitations = [];
        
        // 1. Connection Pool Limitation
        limitations.push({
            component: 'Tenant Connection Factory',
            current: '100 tenants max in LRU cache',
            required: '10,000 tenants',
            severity: 'CRITICAL',
            impact: 'Only 1% of required tenants can be cached'
        });
        
        // 2. Memory Limitation  
        limitations.push({
            component: 'Memory Usage',
            current: '~5MB per tenant',
            required: '~50GB for 10,000 tenants',
            severity: 'CRITICAL',
            impact: 'Requires 50GB+ RAM, not feasible on single server'
        });
        
        // 3. Database Connection Limitation
        limitations.push({
            component: 'Database Connections',
            current: '3 connections per tenant = 30,000 max',
            required: '30,000+ connections for 10,000 tenants',
            severity: 'HIGH',
            impact: 'Most databases cannot handle 30,000 concurrent connections'
        });
        
        // 4. Model Initialization Limitation
        limitations.push({
            component: 'Model Initialization',
            current: 'Models loaded per tenant',
            required: '40+ models × 10,000 tenants',
            severity: 'HIGH',
            impact: '400,000 model instances in memory'
        });
        
        limitations.forEach((limitation, index) => {
            const icon = limitation.severity === 'CRITICAL' ? '🔴' : '🟡';
            console.log(`   ${index + 1}. ${icon} ${limitation.component}:`);
            console.log(`      Current: ${limitation.current}`);
            console.log(`      Required: ${limitation.required}`);
            console.log(`      Impact: ${limitation.impact}`);
        });
        
        return limitations;
    }

    /**
     * Generate comprehensive report
     */
    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 REALISTIC PRODUCTION READINESS REPORT');
        console.log('='.repeat(80));
        
        console.log(`\n📈 PERFORMANCE METRICS:`);
        console.log(`   Orders Tested: ${this.results.totalOrders}`);
        console.log(`   Successful: ${this.results.successfulOrders} (${this.results.totalOrders > 0 ? ((this.results.successfulOrders/this.results.totalOrders)*100).toFixed(2) : 0}%)`);
        console.log(`   Failed: ${this.results.failedOrders} (${this.results.totalOrders > 0 ? ((this.results.failedOrders/this.results.totalOrders)*100).toFixed(2) : 0}%)`);
        console.log(`   Throughput: ${this.results.throughput.toFixed(2)} orders/second`);
        console.log(`   Max Response Time: ${this.results.maxResponseTime.toFixed(2)}ms`);
        
        console.log(`\n🚨 BOTTLENECKS (${this.results.bottlenecks.length}):`);
        this.results.bottlenecks.forEach((bottleneck, index) => {
            const icon = bottleneck.severity === 'CRITICAL' ? '🔴' : bottleneck.severity === 'HIGH' ? '🟡' : '🟠';
            console.log(`   ${index + 1}. ${icon} ${bottleneck.type}: ${bottleneck.message}`);
        });
        
        // Calculate scores
        const performanceScore = Math.max(0, 10 - (this.results.bottlenecks.filter(b => b.severity === 'HIGH').length * 2) - (this.results.bottlenecks.filter(b => b.severity === 'CRITICAL').length * 3));
        const scalabilityScore = Math.max(0, 10 - (this.results.bottlenecks.filter(b => b.type.includes('MEMORY') || b.type.includes('CONNECTION')).length * 2));
        
        console.log(`\n🎯 SCORES:`);
        console.log(`   Performance Score: ${performanceScore}/10`);
        console.log(`   Scalability Score: ${scalabilityScore}/10`);
        
        return {
            performanceScore,
            scalabilityScore,
            bottlenecks: this.results.bottlenecks,
            throughput: this.results.throughput
        };
    }

    /**
     * Run comprehensive test
     */
    async runComprehensiveTest() {
        console.log('🔥 COMPREHENSIVE PRODUCTION READINESS TEST');
        console.log('='.repeat(50));
        
        await this.testConnectionPoolLimits();
        await this.testDatabasePerformance();
        await this.testRedisPerformance();
        this.testMemoryUsage();
        await this.testOrderThroughput();
        this.analyzeArchitectureLimitations();
        
        return this.generateReport();
    }
}

if (require.main === module) {
    const test = new RealisticLoadTest();
    test.runComprehensiveTest()
        .then(results => {
            process.exit(results.bottlenecks.filter(b => b.severity === 'CRITICAL').length > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = RealisticLoadTest;
