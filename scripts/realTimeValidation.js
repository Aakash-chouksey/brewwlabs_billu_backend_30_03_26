#!/usr/bin/env node

/**
 * REAL-TIME SYSTEM VALIDATION
 * 
 * Tests for race conditions, data consistency, and concurrent operations
 */

const fs = require('fs');
const path = require('path');

class RealTimeValidation {
    constructor() {
        this.raceConditions = [];
        this.concurrencyIssues = [];
        this.dataInconsistencies = [];
    }

    /**
     * Test for race conditions in order processing
     */
    async testOrderRaceConditions() {
        console.log('🔍 Testing order processing race conditions...');
        
        // Check order controller for concurrency handling
        const orderControllerPath = path.join(__dirname, '../controllers/orderController.js');
        if (fs.existsSync(orderControllerPath)) {
            const content = fs.readFileSync(orderControllerPath, 'utf8');
            
            // Look for race condition patterns
            const raceConditionPatterns = [
                {
                    pattern: /inventory.*quantity.*--/g,
                    issue: 'Direct inventory decrement without locking',
                    severity: 'CRITICAL'
                },
                {
                    pattern: /UPDATE.*SET.*quantity.*=/g,
                    issue: 'Unsafe inventory updates',
                    severity: 'HIGH'
                },
                {
                    pattern: /SELECT.*quantity.*WHERE/g,
                    issue: 'Read-modify-write pattern without locking',
                    severity: 'HIGH'
                }
            ];
            
            for (const { pattern, issue, severity } of raceConditionPatterns) {
                const matches = content.match(pattern);
                if (matches) {
                    this.raceConditions.push({
                        component: 'Order Processing',
                        issue: issue,
                        severity: severity,
                        occurrences: matches.length,
                        impact: 'Inventory inconsistencies under high concurrency'
                    });
                }
            }
            
            // Check for transaction isolation
            const hasTransactionIsolation = content.includes('ISOLATION') || content.includes('SERIALIZABLE') || content.includes('LOCK');
            if (!hasTransactionIsolation) {
                this.raceConditions.push({
                    component: 'Order Processing',
                    issue: 'No transaction isolation level specified',
                    severity: 'HIGH',
                    occurrences: 1,
                    impact: 'Phantom reads and non-repeatable reads'
                });
            }
        }
        
        console.log(`   ✅ Order race condition analysis complete`);
    }

    /**
     * Test for inventory update concurrency
     */
    async testInventoryConcurrency() {
        console.log('🔍 Testing inventory update concurrency...');
        
        const inventoryFiles = [
            'inventoryController.js',
            'inventorySaleController.js',
            'purchaseController.js'
        ];
        
        for (const file of inventoryFiles) {
            const filePath = path.join(__dirname, '../controllers', file);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Check for atomic inventory operations
                const hasAtomicOperations = content.includes('sequelize.transaction') || content.includes('BEGIN');
                if (!hasAtomicOperations) {
                    this.concurrencyIssues.push({
                        component: file,
                        issue: 'Inventory operations not atomic',
                        severity: 'CRITICAL',
                        impact: 'Stock count discrepancies'
                    });
                }
                
                // Check for optimistic locking
                const hasOptimisticLocking = content.includes('version') || content.includes('updatedAt');
                if (!hasOptimisticLocking) {
                    this.concurrencyIssues.push({
                        component: file,
                        issue: 'No optimistic locking for inventory',
                        severity: 'HIGH',
                        impact: 'Lost updates in concurrent scenarios'
                    });
                }
                
                // Check for pessimistic locking
                const hasPessimisticLocking = content.includes('SELECT.*FOR UPDATE') || content.includes('LOCK');
                if (!hasPessimisticLocking) {
                    this.concurrencyIssues.push({
                        component: file,
                        issue: 'No pessimistic locking for critical operations',
                        severity: 'MEDIUM',
                        impact: 'Potential race conditions in high traffic'
                    });
                }
            }
        }
        
        console.log(`   ✅ Inventory concurrency analysis complete`);
    }

    /**
     * Test for multi-terminal synchronization
     */
    async testMultiTerminalSync() {
        console.log('🔍 Testing multi-terminal synchronization...');
        
        // Check Socket.io implementation
        const appPath = path.join(__dirname, '../app.js');
        if (fs.existsSync(appPath)) {
            const content = fs.readFileSync(appPath, 'utf8');
            
            // Check for real-time order broadcasting
            const hasOrderBroadcast = content.includes('order') && content.includes('emit');
            if (!hasOrderBroadcast) {
                this.dataInconsistencies.push({
                    component: 'Multi-terminal Sync',
                    issue: 'No real-time order broadcasting',
                    severity: 'HIGH',
                    impact: 'Terminals will not see live orders'
                });
            }
            
            // Check for inventory synchronization
            const hasInventorySync = content.includes('inventory') && content.includes('emit');
            if (!hasInventorySync) {
                this.dataInconsistencies.push({
                    component: 'Multi-terminal Sync',
                    issue: 'No real-time inventory synchronization',
                    severity: 'HIGH',
                    impact: 'Inventory levels inconsistent across terminals'
                });
            }
            
            // Check for connection management
            const hasConnectionManagement = content.includes('join-outlet') || content.includes('disconnect');
            if (!hasConnectionManagement) {
                this.dataInconsistencies.push({
                    component: 'Multi-terminal Sync',
                    issue: 'Poor connection management',
                    severity: 'MEDIUM',
                    impact: 'Stale connections and memory leaks'
                });
            }
        }
        
        console.log(`   ✅ Multi-terminal sync analysis complete`);
    }

    /**
     * Test for data consistency patterns
     */
    async testDataConsistencyPatterns() {
        console.log('🔍 Testing data consistency patterns...');
        
        const controllersDir = path.join(__dirname, '../controllers');
        const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));
        
        for (const file of controllerFiles) {
            const filePath = path.join(controllersDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for foreign key constraints
            const hasForeignKeyConstraints = content.includes('references') || content.includes('foreignKey');
            if (!hasForeignKeyConstraints) {
                this.dataInconsistencies.push({
                    component: file,
                    issue: 'Missing foreign key constraints',
                    severity: 'HIGH',
                    impact: 'Orphaned records and data inconsistency'
                });
            }
            
            // Check for unique constraints
            const hasUniqueConstraints = content.includes('unique') || content.includes('UniqueConstraint');
            if (!hasUniqueConstraints) {
                this.dataInconsistencies.push({
                    component: file,
                    issue: 'Missing unique constraints',
                    severity: 'MEDIUM',
                    impact: 'Duplicate records possible'
                });
            }
            
            // Check for cascade operations
            const hasCascadeOperations = content.includes('cascade') || content.includes('onDelete');
            if (!hasCascadeOperations) {
                this.dataInconsistencies.push({
                    component: file,
                    issue: 'No cascade delete/update operations',
                    severity: 'MEDIUM',
                    impact: 'Orphaned records on deletions'
                });
            }
        }
        
        console.log(`   ✅ Data consistency patterns analysis complete`);
    }

    /**
     * Test for concurrent payment processing
     */
    async testConcurrentPayments() {
        console.log('🔍 Testing concurrent payment processing...');
        
        const paymentControllerPath = path.join(__dirname, '../controllers/paymentController.js');
        if (fs.existsSync(paymentControllerPath)) {
            const content = fs.readFileSync(paymentControllerPath, 'utf8');
            
            // Check for payment idempotency
            const hasIdempotency = content.includes('idempotent') || content.includes('duplicate') || content.includes('transactionId');
            if (!hasIdempotency) {
                this.raceConditions.push({
                    component: 'Payment Processing',
                    issue: 'No payment idempotency protection',
                    severity: 'CRITICAL',
                    occurrences: 1,
                    impact: 'Double charges on retry'
                });
            }
            
            // Check for payment state management
            const hasStateManagement = content.includes('status') || content.includes('PENDING') || content.includes('COMPLETED');
            if (!hasStateManagement) {
                this.concurrencyIssues.push({
                    component: 'Payment Processing',
                    issue: 'Poor payment state management',
                    severity: 'HIGH',
                    impact: 'Payment status inconsistencies'
                });
            }
            
            // Check for payment locking
            const hasPaymentLocking = content.includes('LOCK') || content.includes('FOR UPDATE');
            if (!hasPaymentLocking) {
                this.concurrencyIssues.push({
                    component: 'Payment Processing',
                    issue: 'No payment record locking',
                    severity: 'HIGH',
                    impact: 'Concurrent payment processing issues'
                });
            }
        }
        
        console.log(`   ✅ Concurrent payment analysis complete`);
    }

    /**
     * Generate real-time validation report
     */
    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 REAL-TIME SYSTEM VALIDATION REPORT');
        console.log('='.repeat(80));
        
        // Group by severity
        const criticalRaceConditions = this.raceConditions.filter(r => r.severity === 'CRITICAL');
        const highRaceConditions = this.raceConditions.filter(r => r.severity === 'HIGH');
        const criticalConcurrencyIssues = this.concurrencyIssues.filter(c => c.severity === 'CRITICAL');
        const highConcurrencyIssues = this.concurrencyIssues.filter(c => c.severity === 'HIGH');
        const criticalDataIssues = this.dataInconsistencies.filter(d => d.severity === 'CRITICAL');
        const highDataIssues = this.dataInconsistencies.filter(d => d.severity === 'HIGH');
        
        console.log(`\n🚨 CRITICAL RACE CONDITIONS (${criticalRaceConditions.length}):`);
        criticalRaceConditions.forEach((condition, index) => {
            console.log(`   ${index + 1}. 🔴 ${condition.component}:`);
            console.log(`      Issue: ${condition.issue}`);
            console.log(`      Impact: ${condition.impact}`);
            console.log(`      Occurrences: ${condition.occurrences}`);
        });
        
        console.log(`\n⚠️  HIGH RACE CONDITIONS (${highRaceConditions.length}):`);
        highRaceConditions.forEach((condition, index) => {
            console.log(`   ${index + 1}. 🟡 ${condition.component}:`);
            console.log(`      Issue: ${condition.issue}`);
            console.log(`      Impact: ${condition.impact}`);
        });
        
        console.log(`\n🚨 CRITICAL CONCURRENCY ISSUES (${criticalConcurrencyIssues.length}):`);
        criticalConcurrencyIssues.forEach((issue, index) => {
            console.log(`   ${index + 1}. 🔴 ${issue.component}:`);
            console.log(`      Issue: ${issue.issue}`);
            console.log(`      Impact: ${issue.impact}`);
        });
        
        console.log(`\n⚠️  HIGH CONCURRENCY ISSUES (${highConcurrencyIssues.length}):`);
        highConcurrencyIssues.forEach((issue, index) => {
            console.log(`   ${index + 1}. 🟡 ${issue.component}:`);
            console.log(`      Issue: ${issue.issue}`);
            console.log(`      Impact: ${issue.impact}`);
        });
        
        console.log(`\n🚨 CRITICAL DATA INCONSISTENCIES (${criticalDataIssues.length}):`);
        criticalDataIssues.forEach((issue, index) => {
            console.log(`   ${index + 1}. 🔴 ${issue.component}:`);
            console.log(`      Issue: ${issue.issue}`);
            console.log(`      Impact: ${issue.impact}`);
        });
        
        console.log(`\n⚠️  HIGH DATA INCONSISTENCIES (${highDataIssues.length}):`);
        highDataIssues.forEach((issue, index) => {
            console.log(`   ${index + 1}. 🟡 ${issue.component}:`);
            console.log(`      Issue: ${issue.issue}`);
            console.log(`      Impact: ${issue.impact}`);
        });
        
        // Calculate concurrency score
        const criticalWeight = (criticalRaceConditions.length + criticalConcurrencyIssues.length + criticalDataIssues.length) * 3;
        const highWeight = (highRaceConditions.length + highConcurrencyIssues.length + highDataIssues.length) * 2;
        
        const concurrencyScore = Math.max(0, 10 - (criticalWeight + highWeight));
        
        console.log(`\n🎯 CONCURRENCY SCORE: ${concurrencyScore.toFixed(1)}/10`);
        
        return {
            criticalRaceConditions: criticalRaceConditions.length,
            highRaceConditions: highRaceConditions.length,
            criticalConcurrencyIssues: criticalConcurrencyIssues.length,
            highConcurrencyIssues: highConcurrencyIssues.length,
            criticalDataIssues: criticalDataIssues.length,
            highDataIssues: highDataIssues.length,
            concurrencyScore,
            isConcurrencySafe: criticalRaceConditions.length === 0 && criticalConcurrencyIssues.length === 0
        };
    }

    /**
     * Run comprehensive real-time validation
     */
    async runRealTimeValidation() {
        console.log('🔥 COMPREHENSIVE REAL-TIME VALIDATION');
        console.log('='.repeat(50));
        
        await this.testOrderRaceConditions();
        await this.testInventoryConcurrency();
        await this.testMultiTerminalSync();
        await this.testDataConsistencyPatterns();
        await this.testConcurrentPayments();
        
        return this.generateReport();
    }
}

if (require.main === module) {
    const validation = new RealTimeValidation();
    validation.runRealTimeValidation()
        .then(results => {
            console.log(`\n🏁 Real-time Validation Complete`);
            console.log(`   System Concurrency Safe: ${results.isConcurrencySafe ? '✅' : '❌'}`);
            process.exit(results.isConcurrencySafe ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Real-time validation failed:', error);
            process.exit(1);
        });
}

module.exports = RealTimeValidation;
