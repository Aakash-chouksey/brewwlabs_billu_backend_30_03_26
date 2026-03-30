/**
 * DATA CONSISTENCY VERIFICATION SCRIPT
 * Checks for inconsistencies in order-table relationships and tenant scoping
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/brewwlabs'
});

async function verifyDataConsistency() {
  console.log('🔍 Starting Data Consistency Verification...\n');

  try {
    // Get all tenant schemas
    const schemasResult = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%' 
      ORDER BY schema_name
    `);

    const schemas = schemasResult.rows.map(row => row.schema_name);
    console.log(`📊 Found ${schemas.length} tenant schemas: ${schemas.join(', ')}\n`);

    let totalIssues = 0;

    for (const schema of schemas) {
      console.log(`🔍 Checking schema: ${schema}`);
      let schemaIssues = 0;

      try {
        // Check 1: Orders without table_id for dine-in orders
        const dineInWithoutTable = await pool.query(`
          SELECT COUNT(*) as count 
          FROM "${schema}".orders 
          WHERE type = 'DINE_IN' AND (table_id IS NULL OR table_id = '')
        `);

        if (parseInt(dineInWithoutTable.rows[0].count) > 0) {
          console.log(`  ❌ ${dineInWithoutTable.rows[0].count} DINE_IN orders without table_id`);
          schemaIssues++;
        }

        // Check 2: Tables marked OCCUPIED but no current order
        const occupiedWithoutOrder = await pool.query(`
          SELECT COUNT(*) as count 
          FROM "${schema}".tables 
          WHERE status = 'OCCUPIED' AND (current_order_id IS NULL OR current_order_id = '')
        `);

        if (parseInt(occupiedWithoutOrder.rows[0].count) > 0) {
          console.log(`  ❌ ${occupiedWithoutOrder.rows[0].count} tables OCCUPIED but no current_order_id`);
          schemaIssues++;
        }

        // Check 3: Orders with wrong outlet_id (mismatch with table)
        const orderOutletMismatch = await pool.query(`
          SELECT COUNT(*) as count 
          FROM "${schema}".orders o
          LEFT JOIN "${schema}".tables t ON o.table_id = t.id
          WHERE o.table_id IS NOT NULL 
          AND t.id IS NOT NULL 
          AND o.outlet_id != t.outlet_id
        `);

        if (parseInt(orderOutletMismatch.rows[0].count) > 0) {
          console.log(`  ❌ ${orderOutletMismatch.rows[0].count} orders with outlet_id mismatch to table`);
          schemaIssues++;
        }

        // Check 4: Orders with wrong business_id (mismatch with table)
        const orderBusinessMismatch = await pool.query(`
          SELECT COUNT(*) as count 
          FROM "${schema}".orders o
          LEFT JOIN "${schema}".tables t ON o.table_id = t.id
          WHERE o.table_id IS NOT NULL 
          AND t.id IS NOT NULL 
          AND o.business_id != t.business_id
        `);

        if (parseInt(orderBusinessMismatch.rows[0].count) > 0) {
          console.log(`  ❌ ${orderBusinessMismatch.rows[0].count} orders with business_id mismatch to table`);
          schemaIssues++;
        }

        // Check 5: Orders with invalid status
        const invalidStatusOrders = await pool.query(`
          SELECT COUNT(*) as count 
          FROM "${schema}".orders 
          WHERE status NOT IN ('PENDING', 'CREATED', 'KOT_SENT', 'IN_PROGRESS', 'READY', 'SERVED', 'COMPLETED', 'CLOSED', 'CANCELLED', 'ARCHIVED')
        `);

        if (parseInt(invalidStatusOrders.rows[0].count) > 0) {
          console.log(`  ❌ ${invalidStatusOrders.rows[0].count} orders with invalid status`);
          schemaIssues++;
        }

        // Check 6: Tables with invalid status
        const invalidStatusTables = await pool.query(`
          SELECT COUNT(*) as count 
          FROM "${schema}".tables 
          WHERE status NOT IN ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE')
        `);

        if (parseInt(invalidStatusTables.rows[0].count) > 0) {
          console.log(`  ❌ ${invalidStatusTables.rows[0].count} tables with invalid status`);
          schemaIssues++;
        }

        // Check 7: Order items without valid order reference
        const orphanedOrderItems = await pool.query(`
          SELECT COUNT(*) as count 
          FROM "${schema}".order_items oi
          LEFT JOIN "${schema}".orders o ON oi.order_id = o.id
          WHERE o.id IS NULL
        `);

        if (parseInt(orphanedOrderItems.rows[0].count) > 0) {
          console.log(`  ❌ ${orphanedOrderItems.rows[0].count} orphaned order items (no valid order)`);
          schemaIssues++;
        }

        // Check 8: Recent order status distribution
        const statusDistribution = await pool.query(`
          SELECT status, COUNT(*) as count 
          FROM "${schema}".orders 
          WHERE created_at >= NOW() - INTERVAL '24 hours'
          GROUP BY status 
          ORDER BY count DESC
        `);

        console.log(`  📊 Recent order status distribution (last 24h):`);
        statusDistribution.rows.forEach(row => {
          console.log(`    ${row.status}: ${row.count}`);
        });

        if (schemaIssues === 0) {
          console.log(`  ✅ No issues found in ${schema}`);
        } else {
          console.log(`  ❌ Found ${schemaIssues} issues in ${schema}`);
          totalIssues += schemaIssues;
        }

      } catch (schemaError) {
        console.log(`  🚨 Error checking schema ${schema}: ${schemaError.message}`);
        totalIssues++;
      }

      console.log('');
    }

    console.log(`🎯 Data Consistency Check Complete`);
    console.log(`📊 Total issues found: ${totalIssues}`);

    if (totalIssues === 0) {
      console.log(`✅ All schemas passed consistency checks!`);
    } else {
      console.log(`❌ Found ${totalIssues} total issues across all schemas`);
      console.log(`⚠️  Please review and fix the issues listed above`);
    }

  } catch (error) {
    console.error('🚨 Verification failed:', error.message);
  } finally {
    await pool.end();
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyDataConsistency();
}

module.exports = { verifyDataConsistency };
