/**
 * SKU COLUMN MIGRATION
 * 
 * Injects the missing 'sku' column into 'products' and 'inventory_items'
 * tables across all tenant schemas to resolve Sequelize query errors.
 */

const { sequelize } = require('../../config/unified_database');
const { Sequelize } = require('sequelize');

async function migrate() {
  console.log('🚀 STARTING SKU COLUMN MIGRATION...');
  
  try {
    // 1. Get all tenant schemas
    const [schemas] = await sequelize.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
    `);
    
    console.log(`Found ${schemas.length} tenant schemas to process.`);
    
    for (const schema of schemas) {
      const schemaName = schema.schema_name;
      console.log(`\nProcessing schema: ${schemaName}`);
      
      // A. Fix 'products' table
      try {
        const [pCols] = await sequelize.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = :schema AND table_name = 'products' AND column_name = 'sku'
        `, { replacements: { schema: schemaName } });
        
        if (pCols.length === 0) {
          console.log(`  ➕ Adding 'sku' to ${schemaName}.products...`);
          await sequelize.query(`ALTER TABLE "${schemaName}"."products" ADD COLUMN "sku" VARCHAR(255)`);
          console.log(`  ✅ Added 'sku' to ${schemaName}.products`);
        } else {
          console.log(`  ⏭️  'sku' already exists in ${schemaName}.products`);
        }
      } catch (err) {
        console.error(`  ❌ Error processing products in ${schemaName}:`, err.message);
      }
      
      // B. Fix 'inventory_items' table
      try {
        const [iCols] = await sequelize.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = :schema AND table_name = 'inventory_items' AND column_name = 'sku'
        `, { replacements: { schema: schemaName } });
        
        if (iCols.length === 0) {
          console.log(`  ➕ Adding 'sku' to ${schemaName}.inventory_items...`);
          await sequelize.query(`ALTER TABLE "${schemaName}"."inventory_items" ADD COLUMN "sku" VARCHAR(255)`);
          console.log(`  ✅ Added 'sku' to ${schemaName}.inventory_items`);
        } else {
          console.log(`  ⏭️  'sku' already exists in ${schemaName}.inventory_items`);
        }
      } catch (err) {
        console.error(`  ❌ Error processing inventory_items in ${schemaName}:`, err.message);
      }
    }
    
    console.log('\n✨ MIGRATION COMPLETE: All tenant schemas updated.');
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit();
  }
}

migrate();
