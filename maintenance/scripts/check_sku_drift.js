/**
 * SKU DRIFT CHECKER
 * 
 * Audits all tenant schemas for the presence of the 'sku' column
 * in the 'products' and 'inventory_items' tables.
 */

const { sequelize } = require('../../config/unified_database');
const { Sequelize } = require('sequelize');

async function audit() {
  console.log('🔍 AUDITING TENANT SCHEMAS FOR SKU DRIFT...');
  
  try {
    // 1. Get all tenant schemas
    const [schemas] = await sequelize.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
    `);
    
    console.log(`Found ${schemas.length} tenant schemas.`);
    
    const report = [];
    
    for (const schema of schemas) {
      const schemaName = schema.schema_name;
      
      // Check products table
      const [pCols] = await sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = :schema AND table_name = 'products' AND column_name = 'sku'
      `, { replacements: { schema: schemaName } });
      
      // Check inventory_items table
      const [iCols] = await sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = :schema AND table_name = 'inventory_items' AND column_name = 'sku'
      `, { replacements: { schema: schemaName } });
      
      report.push({
        schema: schemaName,
        products_has_sku: pCols.length > 0,
        inventory_items_has_sku: iCols.length > 0
      });
    }
    
    console.log('\n--- SCAN REPORT ---');
    console.table(report);
    
    const driftFound = report.some(r => !r.products_has_sku || !r.inventory_items_has_sku);
    if (driftFound) {
      console.warn('\n🚨 DRIFT DETECTED: Some schemas are missing the SKU column.');
    } else {
      console.log('\n✅ NO DRIFT: All schemas have the SKU column.');
    }
    
  } catch (err) {
    console.error('❌ Audit failed:', err.message);
  } finally {
    process.exit();
  }
}

audit();
