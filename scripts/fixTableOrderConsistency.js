/**
 * DATA CONSISTENCY CHECK & FIX SCRIPT
 * Multi-tenant POS System - Table-Order Consistency Fix
 * 
 * This script fixes data mismatches between tables and orders:
 * 1. Tables with status 'OCCUPIED' but no current_order_id
 * 2. Tables with current_order_id but status not 'OCCUPIED'
 * 3. Active orders with table_id but table status is 'AVAILABLE'
 * 4. Standardizes all status values to uppercase
 */

const { sequelize } = require('../config/db');

const TABLE_STATUSES = {
  AVAILABLE: 'AVAILABLE',
  OCCUPIED: 'OCCUPIED',
  RESERVED: 'RESERVED',
  CLEANING: 'CLEANING'
};

const ORDER_STATUSES = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  KOT_SENT: 'KOT_SENT',
  READY: 'READY',
  SERVED: 'SERVED',
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED'
};

/**
 * Check and fix table-order consistency
 */
async function checkAndFixConsistency() {
  console.log('🔍 Starting Data Consistency Check...\n');

  const models = require('../models');
  await sequelize.authenticate();
  
  const { Table, Order } = models;
  const issues = [];
  const fixes = [];

  // 1. Find tables with inconsistent status values (lowercase)
  console.log('📋 Checking 1: Tables with non-uppercase status values...');
  const tablesWithLowercaseStatus = await Table.findAll({
    where: sequelize.literal("status IS NOT NULL AND status != UPPER(status)")
  });

  for (const table of tablesWithLowercaseStatus) {
    const oldStatus = table.status;
    const newStatus = oldStatus.toUpperCase();
    
    issues.push({
      type: 'LOWERCASE_STATUS',
      tableId: table.id,
      businessId: table.businessId,
      outletId: table.outletId,
      oldValue: oldStatus,
      newValue: newStatus
    });

    // Fix: Update to uppercase
    await table.update({ status: newStatus });
    fixes.push(`✅ Fixed table ${table.id}: status "${oldStatus}" → "${newStatus}"`);
  }
  console.log(`   Found ${tablesWithLowercaseStatus.length} tables with lowercase status\n`);

  // 2. Find OCCUPIED tables without current_order_id
  console.log('📋 Checking 2: OCCUPIED tables without current_order_id...');
  const occupiedTablesWithoutOrder = await Table.findAll({
    where: {
      status: TABLE_STATUSES.OCCUPIED,
      currentOrderId: null
    }
  });

  for (const table of occupiedTablesWithoutOrder) {
    issues.push({
      type: 'OCCUPIED_NO_ORDER',
      tableId: table.id,
      businessId: table.businessId,
      outletId: table.outletId,
      message: 'Table is OCCUPIED but has no current_order_id'
    });

    // Fix: Reset to AVAILABLE
    await table.update({ 
      status: TABLE_STATUSES.AVAILABLE,
      currentOrderId: null 
    });
    fixes.push(`✅ Fixed table ${table.id}: Reset to AVAILABLE (was OCCUPIED without order)`);
  }
  console.log(`   Found ${occupiedTablesWithoutOrder.length} occupied tables without order\n`);

  // 3. Find tables with current_order_id but status not OCCUPIED
  console.log('📋 Checking 3: Tables with current_order_id but not OCCUPIED...');
  const tablesWithOrderNotOccupied = await Table.findAll({
    where: {
      currentOrderId: { [sequelize.Op.ne]: null },
      status: { [sequelize.Op.ne]: TABLE_STATUSES.OCCUPIED }
    }
  });

  for (const table of tablesWithOrderNotOccupied) {
    // Verify the order is still active
    const order = await Order.findByPk(table.currentOrderId);
    
    if (order && !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(order.status)) {
      issues.push({
        type: 'ORDER_LINKED_NOT_OCCUPIED',
        tableId: table.id,
        orderId: table.currentOrderId,
        businessId: table.businessId,
        outletId: table.outletId,
        currentStatus: table.status,
        message: 'Table has active order but status is not OCCUPIED'
      });

      // Fix: Set status to OCCUPIED
      await table.update({ status: TABLE_STATUSES.OCCUPIED });
      fixes.push(`✅ Fixed table ${table.id}: Set status to OCCUPIED (linked to active order ${order.id})`);
    } else if (!order || ['COMPLETED', 'CLOSED', 'CANCELLED'].includes(order.status)) {
      // Order is closed/cancelled, clear the link
      issues.push({
        type: 'STALE_ORDER_LINK',
        tableId: table.id,
        orderId: table.currentOrderId,
        businessId: table.businessId,
        outletId: table.outletId,
        message: 'Table linked to completed/cancelled order'
      });

      await table.update({ 
        status: TABLE_STATUSES.AVAILABLE,
        currentOrderId: null 
      });
      fixes.push(`✅ Fixed table ${table.id}: Cleared stale order link (order ${table.currentOrderId} is ${order?.status || 'deleted'})`);
    }
  }
  console.log(`   Found ${tablesWithOrderNotOccupied.length} tables with order link but wrong status\n`);

  // 4. Find active orders with table_id but table is AVAILABLE
  console.log('📋 Checking 4: Active orders with AVAILABLE table...');
  const activeOrders = await Order.findAll({
    where: {
      tableId: { [sequelize.Op.ne]: null },
      status: { [sequelize.Op.notIn]: ['COMPLETED', 'CLOSED', 'CANCELLED'] }
    }
  });

  for (const order of activeOrders) {
    const table = await Table.findByPk(order.tableId);
    
    if (table && table.status !== TABLE_STATUSES.OCCUPIED) {
      issues.push({
        type: 'ACTIVE_ORDER_AVAILABLE_TABLE',
        orderId: order.id,
        tableId: order.tableId,
        businessId: order.businessId,
        outletId: order.outletId,
        tableStatus: table.status,
        message: 'Active order linked to non-OCCUPIED table'
      });

      // Fix: Update table to OCCUPIED with current order
      await table.update({ 
        status: TABLE_STATUSES.OCCUPIED,
        currentOrderId: order.id 
      });
      fixes.push(`✅ Fixed table ${table.id}: Set to OCCUPIED for active order ${order.id}`);
    }
  }
  console.log(`   Found ${activeOrders.filter(o => o.tableId).length} active orders with tables, checked for mismatches\n`);

  // 5. Find tables with current_order_id pointing to closed/cancelled order
  console.log('📋 Checking 5: Tables with current_order_id to closed orders...');
  const tablesWithOrderId = await Table.findAll({
    where: {
      currentOrderId: { [sequelize.Op.ne]: null }
    }
  });

  let staleLinksFixed = 0;
  for (const table of tablesWithOrderId) {
    const order = await Order.findByPk(table.currentOrderId);
    
    if (!order || ['COMPLETED', 'CLOSED', 'CANCELLED'].includes(order.status)) {
      issues.push({
        type: 'STALE_ORDER_LINK',
        tableId: table.id,
        orderId: table.currentOrderId,
        businessId: table.businessId,
        outletId: table.outletId,
        orderStatus: order?.status || 'deleted',
        message: 'Table linked to non-active order'
      });

      await table.update({ 
        status: TABLE_STATUSES.AVAILABLE,
        currentOrderId: null 
      });
      fixes.push(`✅ Fixed table ${table.id}: Released (order ${table.currentOrderId} is ${order?.status || 'deleted'})`);
      staleLinksFixed++;
    }
  }
  console.log(`   Found ${staleLinksFixed} tables with stale order links\n`);

  // Summary
  console.log('========================================');
  console.log('📊 CONSISTENCY CHECK SUMMARY');
  console.log('========================================');
  console.log(`Total Issues Found: ${issues.length}`);
  console.log(`Total Fixes Applied: ${fixes.length}`);
  console.log('\n📋 Issues by Type:');
  
  const issuesByType = issues.reduce((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {});

  for (const [type, count] of Object.entries(issuesByType)) {
    console.log(`   ${type}: ${count}`);
  }

  if (fixes.length > 0) {
    console.log('\n✅ Fixes Applied:');
    fixes.forEach(fix => console.log(`   ${fix}`));
  }

  console.log('\n========================================');
  console.log('✨ Data Consistency Check Complete!');
  console.log('========================================');

  return {
    issuesFound: issues.length,
    fixesApplied: fixes.length,
    issues,
    fixes
  };
}

/**
 * Run consistency check for a specific tenant/outlet
 */
async function checkTenantConsistency(businessId, outletId) {
  console.log(`🔍 Checking consistency for Business: ${businessId}, Outlet: ${outletId}`);
  
  // Set context for multi-tenant query
  const queryOptions = {
    where: { businessId }
  };
  if (outletId) {
    queryOptions.where.outletId = outletId;
  }

  return await checkAndFixConsistency(queryOptions);
}

// CLI execution
if (require.main === module) {
  checkAndFixConsistency()
    .then((result) => {
      console.log('\nScript completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error running consistency check:', error);
      process.exit(1);
    });
}

module.exports = {
  checkAndFixConsistency,
  checkTenantConsistency
};
