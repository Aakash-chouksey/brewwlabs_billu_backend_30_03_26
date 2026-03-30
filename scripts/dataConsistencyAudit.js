/**
 * COMPREHENSIVE DATA CONSISTENCY AUDIT
 * Multi-tenant POS System - March 2026
 * 
 * This script audits data consistency across all tenants and identifies:
 * - Orders without table_id
 * - Tables marked AVAILABLE but have active orders
 * - Missing foreign keys
 * - Orphan records
 * - Data integrity issues
 */

const { sequelize } = require('../config/unified_database');
const neonTransactionSafeExecutor = require('../services/neonTransactionSafeExecutor');

class DataConsistencyAuditor {
    constructor() {
        this.issues = [];
        this.fixes = [];
        this.warnings = [];
        this.auditResults = {};
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${level}: ${message}`;
        console.log(logEntry);
        if (data) {
            console.log('Data:', JSON.stringify(data, null, 2));
        }
        
        if (level === 'ISSUE') this.issues.push({ message, data, timestamp });
        if (level === 'FIX') this.fixes.push({ message, data, timestamp });
        if (level === 'WARNING') this.warnings.push({ message, data, timestamp });
    }

    async auditAllTenants() {
        this.log('INFO', '🔍 Starting comprehensive data consistency audit for all tenants...');
        
        try {
            // Get all active tenants
            const tenants = await this.getAllTenants();
            this.log('INFO', `Found ${tenants.length} tenants to audit`);

            for (const tenant of tenants) {
                await this.auditTenant(tenant);
            }

            // Cross-tenant consistency checks
            await this.auditCrossTenantConsistency();

            // Generate final report
            this.generateComprehensiveReport();

        } catch (error) {
            this.log('ISSUE', 'Critical error during data consistency audit', { error: error.message });
        }
    }

    async getAllTenants() {
        const result = await sequelize.query(`
            SELECT tr.business_id, tr.schema_name, tr.status, tr.activated_at,
                   b.name as business_name, b.email as business_email
            FROM tenant_registry tr
            JOIN businesses b ON tr.business_id = b.id
            WHERE tr.status = 'ACTIVE'
            ORDER BY tr.created_at DESC
        `, { type: sequelize.QueryTypes.SELECT });

        return result;
    }

    async auditTenant(tenant) {
        this.log('INFO', `🏢 Auditing tenant: ${tenant.schema_name}`);
        
        try {
            await neonTransactionSafeExecutor.executeInTenant(tenant.schema_name, async (context) => {
                const { transactionModels: models } = context;
                
                // Initialize tenant audit results
                if (!this.auditResults[tenant.schema_name]) {
                    this.auditResults[tenant.schema_name] = {};
                }

                // 1. Orders without table_id for dine-in orders
                await this.auditOrdersWithoutTable(models, tenant, context);
                
                // 2. Tables with inconsistent status
                await this.auditTableStatusConsistency(models, tenant, context);
                
                // 3. Missing foreign key constraints
                await this.auditForeignKeys(models, tenant, context);
                
                // 4. Orphaned records
                await this.auditOrphanedRecords(models, tenant, context);
                
                // 5. Data integrity checks
                await this.auditDataIntegrity(models, tenant, context);
            });
            
            this.log('FIX', `✅ Tenant audit completed: ${tenant.schema_name}`);
            
        } catch (error) {
            this.log('ISSUE', `Failed to audit tenant ${tenant.schema_name}`, { error: error.message });
        }
    }

    async auditOrdersWithoutTable(models, tenant, context) {
        this.log('INFO', `🔍 Auditing orders without table assignment...`);
        
        const dineInOrdersWithoutTable = await context.sequelize.query(`
            SELECT id, order_number, type, status, business_id, outlet_id, created_at
            FROM orders
            WHERE business_id = :businessId
            AND type = 'DINE_IN'
            AND (table_id IS NULL OR table_id = '')
        `, {
            replacements: { businessId: tenant.business_id },
            type: context.sequelize.QueryTypes.SELECT,
            transaction: context.transaction
        });

        if (dineInOrdersWithoutTable.length > 0) {
            this.log('ISSUE', `Dine-in orders without table assignment in ${tenant.schema_name}`, {
                count: dineInOrdersWithoutTable.length,
                orders: dineInOrdersWithoutTable
            });
            
            this.auditResults[tenant.schema_name].ordersWithoutTable = dineInOrdersWithoutTable;
        } else {
            this.auditResults[tenant.schema_name].ordersWithoutTable = [];
            this.log('FIX', `✅ All dine-in orders have table assignments`);
        }
    }

    async auditTableStatusConsistency(models, tenant, context) {
        this.log('INFO', `🔍 Auditing table status consistency...`);
        
        // Check tables marked AVAILABLE but have active orders
        const availableTablesWithOrders = await context.sequelize.query(`
            SELECT t.id, t.name, t.table_no, t.status, t.current_order_id,
                   o.id as order_id, o.order_number, o.status as order_status
            FROM tables t
            LEFT JOIN orders o ON t.current_order_id = o.id
            WHERE t.business_id = :businessId
            AND t.status = 'AVAILABLE'
            AND t.current_order_id IS NOT NULL
        `, {
            replacements: { businessId: tenant.business_id },
            type: context.sequelize.QueryTypes.SELECT,
            transaction: context.transaction
        });

        if (availableTablesWithOrders.length > 0) {
            this.log('ISSUE', `Available tables with order links in ${tenant.schema_name}`, {
                count: availableTablesWithOrders.length,
                tables: availableTablesWithOrders
            });
            
            this.auditResults[tenant.schema_name].availableTablesWithOrders = availableTablesWithOrders;
        }

        // Check tables marked OCCUPIED but have no current_order_id
        const occupiedTablesWithoutOrder = await context.sequelize.query(`
            SELECT id, name, table_no, status, current_order_id
            FROM tables
            WHERE business_id = :businessId
            AND status = 'OCCUPIED'
            AND (current_order_id IS NULL OR current_order_id = '')
        `, {
            replacements: { businessId: tenant.business_id },
            type: context.sequelize.QueryTypes.SELECT,
            transaction: context.transaction
        });

        if (occupiedTablesWithoutOrder.length > 0) {
            this.log('ISSUE', `Occupied tables without order links in ${tenant.schema_name}`, {
                count: occupiedTablesWithoutOrder.length,
                tables: occupiedTablesWithoutOrder
            });
            
            this.auditResults[tenant.schema_name].occupiedTablesWithoutOrder = occupiedTablesWithoutOrder;
        }

        // Check tables with active orders but wrong status
        const tablesWithWrongStatus = await context.sequelize.query(`
            SELECT t.id, t.name, t.table_no, t.status as table_status,
                   o.id as order_id, o.order_number, o.status as order_status
            FROM tables t
            JOIN orders o ON t.current_order_id = o.id
            WHERE t.business_id = :businessId
            AND o.status NOT IN ('COMPLETED', 'CLOSED', 'CANCELLED')
            AND t.status != 'OCCUPIED'
        `, {
            replacements: { businessId: tenant.business_id },
            type: context.sequelize.QueryTypes.SELECT,
            transaction: context.transaction
        });

        if (tablesWithWrongStatus.length > 0) {
            this.log('ISSUE', `Tables with wrong status for active orders in ${tenant.schema_name}`, {
                count: tablesWithWrongStatus.length,
                tables: tablesWithWrongStatus
            });
            
            this.auditResults[tenant.schema_name].tablesWithWrongStatus = tablesWithWrongStatus;
        }

        // Log summary
        const totalIssues = availableTablesWithOrders.length + occupiedTablesWithoutOrder.length + tablesWithWrongStatus.length;
        if (totalIssues === 0) {
            this.log('FIX', `✅ Table status consistency is perfect`);
        }
    }

    async auditForeignKeys(models, tenant, context) {
        this.log('INFO', `🔍 Auditing foreign key constraints...`);
        
        const fkIssues = [];

        // Check orders with invalid table_id
        const ordersWithInvalidTable = await context.sequelize.query(`
            SELECT o.id, o.order_number, o.table_id
            FROM orders o
            WHERE o.business_id = :businessId
            AND o.table_id IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM tables t 
                WHERE t.id = o.table_id 
                AND t.business_id = :businessId
            )
        `, {
            replacements: { businessId: tenant.business_id },
            type: context.sequelize.QueryTypes.SELECT,
            transaction: context.transaction
        });

        if (ordersWithInvalidTable.length > 0) {
            fkIssues.push({
                type: 'INVALID_TABLE_FK',
                description: 'Orders reference non-existent tables',
                count: ordersWithInvalidTable.length,
                records: ordersWithInvalidTable
            });
        }

        // Check order_items with invalid order_id
        const orderItemsWithInvalidOrder = await context.sequelize.query(`
            SELECT oi.id, oi.order_id, oi.product_id
            FROM order_items oi
            WHERE oi.business_id = :businessId
            AND NOT EXISTS (
                SELECT 1 FROM orders o 
                WHERE o.id = oi.order_id 
                AND o.business_id = :businessId
            )
        `, {
            replacements: { businessId: tenant.business_id },
            type: context.sequelize.QueryTypes.SELECT,
            transaction: context.transaction
        });

        if (orderItemsWithInvalidOrder.length > 0) {
            fkIssues.push({
                type: 'INVALID_ORDER_FK',
                description: 'Order items reference non-existent orders',
                count: orderItemsWithInvalidOrder.length,
                records: orderItemsWithInvalidOrder
            });
        }

        if (fkIssues.length > 0) {
            this.log('ISSUE', `Foreign key constraint issues in ${tenant.schema_name}`, {
                issues: fkIssues
            });
            
            this.auditResults[tenant.schema_name].foreignKeyIssues = fkIssues;
        } else {
            this.log('FIX', `✅ All foreign key constraints are valid`);
        }
    }

    async auditOrphanedRecords(models, tenant, context) {
        this.log('INFO', `🔍 Auditing orphaned records...`);
        
        const orphanedIssues = [];

        // Check order_items for orphaned records (no valid order)
        const orphanedOrderItems = await context.sequelize.query(`
            SELECT oi.id, oi.order_id, oi.product_id
            FROM order_items oi
            LEFT JOIN orders o ON oi.order_id = o.id
            WHERE oi.business_id = :businessId
            AND o.id IS NULL
        `, {
            replacements: { businessId: tenant.business_id },
            type: context.sequelize.QueryTypes.SELECT,
            transaction: context.transaction
        });

        if (orphanedOrderItems.length > 0) {
            orphanedIssues.push({
                type: 'ORPHANED_ORDER_ITEMS',
                description: 'Order items with no valid order',
                count: orphanedOrderItems.length,
                records: orphanedOrderItems
            });
        }

        // Check tables with invalid area_id
        const tablesWithInvalidArea = await context.sequelize.query(`
            SELECT t.id, t.name, t.area_id
            FROM tables t
            WHERE t.business_id = :businessId
            AND t.area_id IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM areas a 
                WHERE a.id = t.area_id 
                AND a.business_id = :businessId
            )
        `, {
            replacements: { businessId: tenant.business_id },
            type: context.sequelize.QueryTypes.SELECT,
            transaction: context.transaction
        });

        if (tablesWithInvalidArea.length > 0) {
            orphanedIssues.push({
                type: 'INVALID_AREA_FK',
                description: 'Tables reference non-existent areas',
                count: tablesWithInvalidArea.length,
                records: tablesWithInvalidArea
            });
        }

        if (orphanedIssues.length > 0) {
            this.log('ISSUE', `Orphaned records in ${tenant.schema_name}`, {
                issues: orphanedIssues
            });
            
            this.auditResults[tenant.schema_name].orphanedRecords = orphanedIssues;
        } else {
            this.log('FIX', `✅ No orphaned records found`);
        }
    }

    async auditDataIntegrity(models, tenant, context) {
        this.log('INFO', `🔍 Auditing data integrity...`);
        
        const integrityIssues = [];

        // Check for duplicate table numbers within same outlet
        const duplicateTableNumbers = await context.sequelize.query(`
            SELECT table_no, COUNT(*) as count
            FROM tables
            WHERE business_id = :businessId
            AND outlet_id IS NOT NULL
            AND table_no IS NOT NULL
            GROUP BY table_no, outlet_id
            HAVING COUNT(*) > 1
        `, {
            replacements: { businessId: tenant.business_id },
            type: context.sequelize.QueryTypes.SELECT,
            transaction: context.transaction
        });

        if (duplicateTableNumbers.length > 0) {
            integrityIssues.push({
                type: 'DUPLICATE_TABLE_NUMBERS',
                description: 'Duplicate table numbers within same outlet',
                count: duplicateTableNumbers.length,
                records: duplicateTableNumbers
            });
        }

        // Check for products without category when categories exist
        const productsWithoutCategory = await context.sequelize.query(`
            SELECT p.id, p.name, p.category_id
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.business_id = :businessId
            AND p.category_id IS NULL
            AND EXISTS (SELECT 1 FROM categories WHERE business_id = :businessId LIMIT 1)
        `, {
            replacements: { businessId: tenant.business_id },
            type: context.sequelize.QueryTypes.SELECT,
            transaction: context.transaction
        });

        if (productsWithoutCategory.length > 0) {
            integrityIssues.push({
                type: 'PRODUCTS_WITHOUT_CATEGORY',
                description: 'Products without category assignment when categories exist',
                count: productsWithoutCategory.length,
                records: productsWithoutCategory
            });
        }

        if (integrityIssues.length > 0) {
            this.log('ISSUE', `Data integrity issues in ${tenant.schema_name}`, {
                issues: integrityIssues
            });
            
            this.auditResults[tenant.schema_name].dataIntegrityIssues = integrityIssues;
        } else {
            this.log('FIX', `✅ Data integrity checks passed`);
        }
    }

    async auditCrossTenantConsistency() {
        this.log('INFO', '🌐 Auditing cross-tenant consistency...');
        
        // Check for duplicate business emails
        const duplicateBusinessEmails = await sequelize.query(`
            SELECT email, COUNT(*) as count
            FROM businesses
            GROUP BY email
            HAVING COUNT(*) > 1
        `, { type: sequelize.QueryTypes.SELECT });

        if (duplicateBusinessEmails.length > 0) {
            this.log('ISSUE', 'Duplicate business emails found', {
                duplicates: duplicateBusinessEmails
            });
        }

        // Check for tenants without corresponding businesses
        const orphanedTenants = await sequelize.query(`
            SELECT tr.id, tr.business_id, tr.schema_name
            FROM tenant_registry tr
            LEFT JOIN businesses b ON tr.business_id = b.id
            WHERE b.id IS NULL
        `, { type: sequelize.QueryTypes.SELECT });

        if (orphanedTenants.length > 0) {
            this.log('ISSUE', 'Orphaned tenant registries found', {
                orphaned: orphanedTenants
            });
        }
    }

    generateComprehensiveReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 COMPREHENSIVE DATA CONSISTENCY AUDIT REPORT');
        console.log('='.repeat(80));
        
        console.log(`\n🚨 CRITICAL ISSUES FOUND: ${this.issues.length}`);
        this.issues.forEach((issue, index) => {
            console.log(`\n${index + 1}. ${issue.message}`);
            if (issue.data) {
                console.log('   Details:', JSON.stringify(issue.data, null, 2));
            }
        });

        console.log(`\n⚠️  WARNINGS: ${this.warnings.length}`);
        this.warnings.forEach((warning, index) => {
            console.log(`\n${index + 1}. ${warning.message}`);
        });

        console.log(`\n✅ FIXES APPLIED: ${this.fixes.length}`);
        this.fixes.forEach((fix, index) => {
            console.log(`\n${index + 1}. ${fix.message}`);
        });

        // Tenant-by-tenant summary
        console.log('\n📋 TENANT AUDIT SUMMARY:');
        for (const [tenantName, results] of Object.entries(this.auditResults)) {
            console.log(`\n🏢 ${tenantName}:`);
            
            const issueCount = Object.values(results).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
            if (issueCount === 0) {
                console.log('   ✅ No data consistency issues found');
            } else {
                console.log(`   🚨 ${issueCount} data consistency issues:`);
                
                for (const [issueType, issueData] of Object.entries(results)) {
                    if (Array.isArray(issueData) && issueData.length > 0) {
                        console.log(`     - ${issueType}: ${issueData.length} issues`);
                    }
                }
            }
        }

        // Overall summary
        const totalIssues = this.issues.length + this.warnings.length;
        if (totalIssues === 0) {
            console.log('\n🎉 SYSTEM DATA CONSISTENCY IS PERFECT - No issues found!');
        } else {
            console.log(`\n📋 OVERALL SUMMARY: ${totalIssues} data consistency issues need attention`);
            console.log(`   - Critical Issues: ${this.issues.length}`);
            console.log(`   - Warnings: ${this.warnings.length}`);
        }

        console.log('\n' + '='.repeat(80));
    }

    // Auto-fix method for common issues
    async autoFixIssues() {
        this.log('INFO', '🔧 Attempting to auto-fix common data consistency issues...');
        
        for (const [tenantName, results] of Object.entries(this.auditResults)) {
            try {
                await neonTransactionSafeExecutor.executeInTenant(tenantName, async (context) => {
                    const { transactionModels: models } = context;
                    
                    // Auto-fix available tables with orders
                    if (results.availableTablesWithOrders && results.availableTablesWithOrders.length > 0) {
                        for (const table of results.availableTablesWithOrders) {
                            await models.Table.update(
                                { status: 'OCCUPIED' },
                                { where: { id: table.id }, transaction: context.transaction }
                            );
                            this.log('FIX', `Auto-fixed table ${table.id} status to OCCUPIED`);
                        }
                    }
                    
                    // Auto-fix occupied tables without orders
                    if (results.occupiedTablesWithoutOrder && results.occupiedTablesWithoutOrder.length > 0) {
                        for (const table of results.occupiedTablesWithoutOrder) {
                            await models.Table.update(
                                { status: 'AVAILABLE', currentOrderId: null },
                                { where: { id: table.id }, transaction: context.transaction }
                            );
                            this.log('FIX', `Auto-fixed table ${table.id} status to AVAILABLE`);
                        }
                    }
                });
            } catch (error) {
                this.log('ISSUE', `Failed to auto-fix tenant ${tenantName}`, { error: error.message });
            }
        }
    }
}

// Main execution
async function runDataConsistencyAudit() {
    const auditor = new DataConsistencyAuditor();
    
    console.log('🚀 Starting comprehensive data consistency audit...');
    
    try {
        await auditor.auditAllTenants();
        
        // Optionally auto-fix issues
        if (process.argv.includes('--fix')) {
            await auditor.autoFixIssues();
        }
        
        console.log('✅ Data consistency audit completed successfully');
    } catch (error) {
        console.error('🚨 Data consistency audit failed with error:', error);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = DataConsistencyAuditor;

// Run if called directly
if (require.main === module) {
    runDataConsistencyAudit();
}
