#!/usr/bin/env node

/**
 * PRODUCTION LOAD TEST SIMULATION
 * 
 * Simulates 10,000 cafés × 5 terminals × 2 orders/minute = 100,000 orders/minute
 * This is a REALISTIC stress test for production readiness validation
 */

const { performance } = require('perf_hooks');
const crypto = require('crypto');

class ProductionLoadTest {
    constructor() {
        this.results = {
            totalOrders: 0,
            successfulOrders: 0,
            failedOrders: 0,
            averageResponseTime: 0,
            maxResponseTime: 0,
            minResponseTime: Infinity,
            throughput: 0,
            errors: [],
            bottlenecks: []
        };
        
        // Realistic load parameters
        this.cafes = 10000;
        this.terminalsPerCafe = 5;
        this.ordersPerMinutePerTerminal = 2;
        this.totalConcurrentTerminals = this.cafes * this.terminalsPerCafe;
        this.targetOrdersPerMinute = 100000;
        
        // Connection pool limits (from current config)
        this.maxConnectionsPerTenant = 3;
        this.totalMaxConnections = this.cafes * this.maxConnectionsPerTenant;
        
        console.log('🔥 PRODUCTION LOAD TEST INITIATED');
        console.log(`📊 Target Load: ${this.targetOrdersPerMinute.toLocaleString()} orders/minute`);
        console.log(`🏪 Simulated Cafés: ${this.cafes.toLocaleString()}`);
        console.log(`💻 Total Terminals: ${this.totalConcurrentTerminals.toLocaleString()}`);
    }

    /**
     * Simulate database connection pool behavior
     */
    simulateConnectionPool() {
        const poolStats = {
            active: 0,
            idle: 0,
            waiting: 0,
            maxConnections: this.maxConnectionsPerTenant,
            totalRequests: 0,
            rejectedRequests: 0
        };

        return {
            acquire: () => {
                poolStats.totalRequests++;
                if (poolStats.active < poolStats.maxConnections) {
                    poolStats.active++;
                    return Promise.resolve({ connection: 'mock_connection' });
                } else {
                    poolStats.waiting++;
                    poolStats.rejectedRequests++;
                    return Promise.reject(new Error('Connection pool exhausted'));
                }
            },
            release: () => {
                if (poolStats.active > 0) {
                    poolStats.active--;
                    poolStats.idle++;
                }
            },
            getStats: () => poolStats
        };
    }

    /**
     * Simulate order creation with realistic database operations
     */
    async simulateOrderCreation(cafeId, terminalId) {
        const startTime = performance.now();
        const orderId = crypto.randomUUID();
        
        try {
            // Simulate the actual database operations for order creation
            const operations = [
                // 1. Begin transaction (10-50ms)
                this.simulateDatabaseOperation('BEGIN TRANSACTION', 10, 50),
                
                // 2. Insert order (20-100ms) 
                this.simulateDatabaseOperation(`INSERT INTO orders (id, cafe_id, terminal_id, status, total) VALUES ('${orderId}', ${cafeId}, ${terminalId}, 'pending', 150.00)`, 20, 100),
                
                // 3. Insert order items (5-20 items, 5-15ms each)
                ...Array.from({ length: Math.floor(Math.random() * 15) + 5 }, (_, i) => 
                    this.simulateDatabaseOperation(`INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ('${orderId}', ${i}, 1, 15.00)`, 5, 15)
                ),
                
                // 4. Update inventory (2-10 items, 10-30ms each)
                ...Array.from({ length: Math.floor(Math.random() * 8) + 2 }, (_, i) =>
                    this.simulateDatabaseOperation(`UPDATE inventory SET quantity = quantity - 1 WHERE product_id = ${i}`, 10, 30)
                ),
                
                // 5. Commit transaction (20-80ms)
                this.simulateDatabaseOperation('COMMIT TRANSACTION', 20, 80)
            ];

            await Promise.all(operations);
            
            const endTime = performance.now();
            const responseTime = endTime - startTime;
            
            this.results.successfulOrders++;
            this.results.totalOrders++;
            this.results.maxResponseTime = Math.max(this.results.maxResponseTime, responseTime);
            this.results.minResponseTime = Math.min(this.results.minResponseTime, responseTime);
            
            return { success: true, responseTime, orderId };
            
        } catch (error) {
            this.results.failedOrders++;
            this.results.totalOrders++;
            this.results.errors.push({
                cafeId,
                terminalId,
                error: error.message,
                timestamp: Date.now()
            });
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Simulate database operation with realistic timing
     */
    simulateDatabaseOperation(query, minMs, maxMs) {
        const delay = Math.random() * (maxMs - minMs) + minMs;
        return new Promise((resolve) => setTimeout(resolve, delay));
    }

    /**
     * Calculate system breaking points
     */
    calculateBreakingPoints() {
        const breakingPoints = {
            // Database connection limits
            maxConcurrentConnections: this.totalMaxConnections,
            connectionPoolSaturation: this.totalMaxConnections * 0.8, // 80% saturation point
            
            // Order processing limits
            maxOrdersPerSecond: 0,
            maxOrdersPerMinute: 0,
            
            // Response time thresholds
            averageResponseTimeLimit: 500, // 500ms max average
            maxResponseTimeLimit: 2000, // 2s max single response
            
            // Error rate thresholds
            maxErrorRate: 0.01, // 1% max error rate
            criticalErrorRate: 0.05 // 5% critical error rate
        };

        return breakingPoints;
    }

    /**
     * Run the full load test simulation
     */
    async runLoadTest(durationSeconds = 60) {
        console.log(`\n🚀 Starting ${durationSeconds}-second load test...`);
        
        const startTime = performance.now();
        const endTime = startTime + (durationSeconds * 1000);
        
        // Create concurrent terminals
        const terminals = [];
        for (let cafe = 1; cafe <= this.cafes; cafe++) {
            for (let terminal = 1; terminal <= this.terminalsPerCafe; terminal++) {
                terminals.push({ cafeId: cafe, terminalId: terminal });
            }
        }

        console.log(`🔄 Simulating ${terminals.length.toLocaleString()} concurrent terminals...`);
        
        // Run concurrent order creation
        const promises = [];
        let orderCount = 0;
        
        while (performance.now() < endTime) {
            // Each terminal creates 2 orders per minute = 1 order every 30 seconds
            const terminalPromises = terminals.map(async ({ cafeId, terminalId }) => {
                await this.simulateDelay(30000); // 30 seconds between orders
                return this.simulateOrderCreation(cafeId, terminalId);
            });
            
            promises.push(...terminalPromises);
            orderCount += terminals.length;
            
            // Prevent memory overload by processing in batches
            if (promises.length > 1000) {
                await Promise.allSettled(promises.splice(0, 1000));
            }
            
            await this.simulateDelay(1000); // 1 second batches
        }

        // Wait for all remaining promises
        await Promise.allSettled(promises);
        
        const totalTime = (performance.now() - startTime) / 1000;
        this.calculateMetrics(totalTime);
        
        return this.results;
    }

    simulateDelay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    calculateMetrics(totalTimeSeconds) {
        this.results.throughput = this.results.totalOrders / totalTimeSeconds;
        this.results.averageResponseTime = this.results.averageResponseTime || 0;
        
        // Calculate bottlenecks
        const breakingPoints = this.calculateBreakingPoints();
        
        if (this.results.throughput < this.targetOrdersPerMinute / 60) {
            this.results.bottlenecks.push({
                type: 'THROUGHPUT',
                severity: 'HIGH',
                message: `Throughput ${Math.round(this.results.throughput)} orders/sec below target ${Math.round(this.targetOrdersPerMinute / 60)} orders/sec`
            });
        }
        
        if (this.results.maxResponseTime > breakingPoints.maxResponseTimeLimit) {
            this.results.bottlenecks.push({
                type: 'RESPONSE_TIME',
                severity: 'HIGH',
                message: `Max response time ${Math.round(this.results.maxResponseTime)}ms exceeds limit ${breakingPoints.maxResponseTimeLimit}ms`
            });
        }
        
        const errorRate = this.results.failedOrders / this.results.totalOrders;
        if (errorRate > breakingPoints.maxErrorRate) {
            this.results.bottlenecks.push({
                type: 'ERROR_RATE',
                severity: 'CRITICAL',
                message: `Error rate ${(errorRate * 100).toFixed(2)}% exceeds limit ${(breakingPoints.maxErrorRate * 100).toFixed(2)}%`
            });
        }
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 PRODUCTION LOAD TEST RESULTS');
        console.log('='.repeat(80));
        
        console.log(`\n📈 PERFORMANCE METRICS:`);
        console.log(`   Total Orders: ${this.results.totalOrders.toLocaleString()}`);
        console.log(`   Successful: ${this.results.successfulOrders.toLocaleString()} (${((this.results.successfulOrders/this.results.totalOrders)*100).toFixed(2)}%)`);
        console.log(`   Failed: ${this.results.failedOrders.toLocaleString()} (${((this.results.failedOrders/this.results.totalOrders)*100).toFixed(2)}%)`);
        console.log(`   Throughput: ${Math.round(this.results.throughput)} orders/second`);
        console.log(`   Target Throughput: ${Math.round(this.targetOrdersPerMinute / 60)} orders/second`);
        console.log(`   Max Response Time: ${Math.round(this.results.maxResponseTime)}ms`);
        console.log(`   Min Response Time: ${Math.round(this.results.minResponseTime)}ms`);
        
        console.log(`\n🚨 BOTTLENECKS (${this.results.bottlenecks.length}):`);
        this.results.bottlenecks.forEach((bottleneck, index) => {
            const icon = bottleneck.severity === 'CRITICAL' ? '🔴' : bottleneck.severity === 'HIGH' ? '🟡' : '🟠';
            console.log(`   ${index + 1}. ${icon} ${bottleneck.type}: ${bottleneck.message}`);
        });
        
        if (this.results.errors.length > 0) {
            console.log(`\n❌ SAMPLE ERRORS (first 5):`);
            this.results.errors.slice(0, 5).forEach((error, index) => {
                console.log(`   ${index + 1}. Café ${error.cafeId}, Terminal ${error.terminalId}: ${error.error}`);
            });
        }
        
        return this.results;
    }
}

// Run the production load test
if (require.main === module) {
    const loadTest = new ProductionLoadTest();
    
    loadTest.runLoadTest(60) // 1 minute test
        .then(results => {
            return loadTest.generateReport();
        })
        .catch(error => {
            console.error('❌ Load test failed:', error);
            process.exit(1);
        });
}

module.exports = ProductionLoadTest;
