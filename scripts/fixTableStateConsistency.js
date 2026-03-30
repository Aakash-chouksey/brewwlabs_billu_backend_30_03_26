/**
 * TABLE STATE CONSISTENCY FIX
 * Multi-tenant POS System - March 2026
 * 
 * This script ensures table-order consistency by:
 * 1. Fixing tables with wrong status
 * 2. Adding missing current_order_id
 * 3. Releasing tables from completed orders
 * 4. Occupying tables for active orders
 */

const { sequelize } = require('../config/unified_database');
const neonTransactionSafeExecutor = require('../services/neonTransactionSafeExecutor');

class TableStateConsistencyFixer {
    constructor() {
        this.issues = [];
        this.fixes = [];
        this.warnings = [];
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

    async fixAllTenants() {
        this.log('INFO', '🔧 Starting table state consistency fix for all tenants...');
        
        try {
            // Get all active tenants
            const tenants = await this.getAllTenants();
            this.log('INFO', `Found ${tenants.length} tenants to fix`);

            for (const tenant of tenants) {
                await this.fixTenantTableState(tenant);
            }

            // Generate final report
            this.generateReport();

        } catch (error) {
            this.log('ISSUE', 'Critical error during table state fix', { error: error.message });
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

    async fixTenantTableState(tenant) {
        this.log('INFO', `🏢 Fixing table state for tenant: ${tenant.schema_name}`);
        
        try {
            await neonTransactionSafeExecutor.executeInTenant(tenant.schema_name, async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Table, Order } = models;
                
                // Step 1: Fix tables marked OCCUPIED but have no current_order_id
                await this.fixOccupiedTablesWithoutOrder(models, tenant, transaction);
                
                // Step 2: Fix tables marked AVAILABLE but have current_order_id
                await this.fixAvailableTablesWithOrder(models, tenant, transaction);
                
                // Step 3: Release tables linked to completed/cancelled orders
                await this.releaseTablesFromCompletedOrders(models, tenant, transaction);
                
                // Step 4: Occupy tables for active orders
                await this.occupyTablesForActiveOrders(models, tenant, transaction);
                
                // Step 5: Normalize status values to uppercase
                await this.normalizeStatusValues(models, tenant, transaction);
            });
            
            this.log('FIX', `✅ Table state consistency fixed for tenant: ${tenant.schema_name}`);
            
        } catch (error) {
            this.log('ISSUE', `Failed to fix tenant ${tenant.schema_name}`, { error: error.message });
        }
    }

    async fixOccupiedTablesWithoutOrder(models, tenant, transaction) {
        this.log('INFO', `🔍 Fixing OCCUPIED tables without order for ${tenant.schema_name}`);
        
        const tablesToFix = await models.Table.findAll({
            where: {
                businessId: tenant.business_id,
                status: 'OCCUPIED',
                currentOrderId: { [sequelize.Sequelize.Op.or]: [null, ''] }
            },
            transaction
        });

        for (const table of tablesToFix) {
            this.log('ISSUE', `Table ${table.id} marked OCCUPIED but has no current_order_id`, {
                tableId: table.id,
                tableName: table.name,
                tableNo: table.tableNo
            });
            
            await models.Table.update(
                { status: 'AVAILABLE', currentOrderId: null },
                { where: { id: table.id }, transaction }
            );
            
            this.log('FIX', `Fixed table ${table.id} - Set to AVAILABLE`);
        }
    }

    async fixAvailableTablesWithOrder(models, tenant, transaction) {
        this.log('INFO', `🔍 Fixing AVAILABLE tables with order for ${tenant.schema_name}`);
        
        const tablesToFix = await models.Table.findAll({
            where: {
                businessId: tenant.business_id,
                status: 'AVAILABLE',
                currentOrderId: { [sequelize.Sequelize.Op.not]: null }
            },
            transaction
        });

        for (const table of tablesToFix) {
            // Check if the linked order is still active
            const order = await models.Order.findOne({
                where: {
                    id: table.currentOrderId,
                    status: { [sequelize.Sequelize.Op.notIn]: ['COMPLETED', 'CLOSED', 'CANCELLED'] }
                },
                transaction
            });

            if (order) {
                this.log('ISSUE', `Table ${table.id} marked AVAILABLE but has active order ${table.currentOrderId}`, {
                    tableId: table.id,
                    tableName: table.name,
                    tableNo: table.tableNo,
                    orderId: table.currentOrderId,
                    orderStatus: order.status
                });
                
                await models.Table.update(
                    { status: 'OCCUPIED' },
                    { where: { id: table.id }, transaction }
                );
                
                this.log('FIX', `Fixed table ${table.id} - Set to OCCUPIED`);
            } else {
                // Order is completed, clear the link
                await models.Table.update(
                    { status: 'AVAILABLE', currentOrderId: null },
                    { where: { id: table.id }, transaction }
                );
                
                this.log('FIX', `Fixed table ${table.id} - Cleared completed order link`);
            }
        }
    }

    async releaseTablesFromCompletedOrders(models, tenant, transaction) {
        this.log('INFO', `🔍 Releasing tables from completed orders for ${tenant.schema_name}`);
        
        const completedOrders = await models.Order.findAll({
            where: {
                businessId: tenant.business_id,
                tableId: { [sequelize.Sequelize.Op.not]: null },
                status: ['COMPLETED', 'CLOSED', 'CANCELLED']
            },
            include: [{ model: models.Table, as: 'table' }],
            transaction
        });

        for (const order of completedOrders) {
            if (order.table && order.table.status === 'OCCUPIED') {
                this.log('ISSUE', `Table ${order.table.id} still OCCUPIED for completed order ${order.id}`, {
                    tableId: order.table.id,
                    tableName: order.table.name,
                    tableNo: order.table.tableNo,
                    orderId: order.id,
                    orderStatus: order.status
                });
                
                await models.Table.update(
                    { status: 'AVAILABLE', currentOrderId: null },
                    { where: { id: order.table.id }, transaction }
                );
                
                this.log('FIX', `Released table ${order.table.id} from completed order ${order.id}`);
            }
        }
    }

    async occupyTablesForActiveOrders(models, tenant, transaction) {
        this.log('INFO', `🔍 Occupying tables for active orders for ${tenant.schema_name}`);
        
        const activeOrders = await models.Order.findAll({
            where: {
                businessId: tenant.business_id,
                tableId: { [sequelize.Sequelize.Op.not]: null },
                status: { [sequelize.Sequelize.Op.notIn]: ['COMPLETED', 'CLOSED', 'CANCELLED'] }
            },
            include: [{ model: models.Table, as: 'table' }],
            transaction
        });

        for (const order of activeOrders) {
            if (order.table && order.table.status !== 'OCCUPIED') {
                this.log('ISSUE', `Table ${order.table.id} not OCCUPIED for active order ${order.id}`, {
                    tableId: order.table.id,
                    tableName: order.table.name,
                    tableNo: order.table.tableNo,
                    orderId: order.id,
                    orderStatus: order.status,
                    currentTableStatus: order.table.status
                });
                
                await models.Table.update(
                    { 
                        status: 'OCCUPIED',
                        currentOrderId: order.id
                    },
                    { where: { id: order.table.id }, transaction }
                );
                
                this.log('FIX', `Occupied table ${order.table.id} for active order ${order.id}`);
            }
        }
    }

    async normalizeStatusValues(models, tenant, transaction) {
        this.log('INFO', `🔍 Normalizing status values to uppercase for ${tenant.schema_name}`);
        
        // Fix any lowercase status values
        const tablesWithLowercaseStatus = await models.Table.findAll({
            where: {
                businessId: tenant.business_id,
                status: { 
                    [sequelize.Sequelize.Op.or]: [
                        { [sequelize.Sequelize.Op.like]: 'available' },
                        { [sequelize.Sequelize.Op.like]: 'occupied' },
                        { [sequelize.Sequelize.Op.like]: 'reserved' },
                        { [sequelize.Sequelize.Op.like]: 'cleaning' }
                    ]
                }
            },
            transaction
        });

        for (const table of tablesWithLowercaseStatus) {
            const upperStatus = table.status.toUpperCase();
            this.log('ISSUE', `Table ${table.id} has lowercase status: ${table.status}`, {
                tableId: table.id,
                tableName: table.name,
                currentStatus: table.status,
                fixedStatus: upperStatus
            });
            
            await models.Table.update(
                { status: upperStatus },
                { where: { id: table.id }, transaction }
            );
            
            this.log('FIX', `Normalized table ${table.id} status to ${upperStatus}`);
        }
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 TABLE STATE CONSISTENCY FIX REPORT');
        console.log('='.repeat(80));
        
        console.log(`\n🚨 ISSUES FOUND: ${this.issues.length}`);
        this.issues.forEach((issue, index) => {
            console.log(`\n${index + 1}. ${issue.message}`);
            if (issue.data) {
                console.log('   Details:', JSON.stringify(issue.data, null, 2));
            }
        });

        console.log(`\n✅ FIXES APPLIED: ${this.fixes.length}`);
        this.fixes.forEach((fix, index) => {
            console.log(`\n${index + 1}. ${fix.message}`);
        });

        console.log(`\n⚠️  WARNINGS: ${this.warnings.length}`);
        this.warnings.forEach((warning, index) => {
            console.log(`\n${index + 1}. ${warning.message}`);
        });

        // Summary
        const totalIssues = this.issues.length + this.warnings.length;
        if (totalIssues === 0) {
            console.log('\n🎉 TABLE STATE IS CONSISTENT - No issues found!');
        } else {
            console.log(`\n📋 SUMMARY: ${totalIssues} table state issues were fixed`);
            console.log(`   - Issues Fixed: ${this.issues.length}`);
            console.log(`   - Warnings: ${this.warnings.length}`);
        }

        console.log('\n' + '='.repeat(80));
    }
}

// Main execution
async function runTableStateFix() {
    const fixer = new TableStateConsistencyFixer();
    
    console.log('🚀 Starting table state consistency fix...');
    
    try {
        await fixer.fixAllTenants();
        console.log('✅ Table state consistency fix completed successfully');
    } catch (error) {
        console.error('🚨 Table state fix failed with error:', error);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = TableStateConsistencyFixer;

// Run if called directly
if (require.main === module) {
    runTableStateFix();
}
