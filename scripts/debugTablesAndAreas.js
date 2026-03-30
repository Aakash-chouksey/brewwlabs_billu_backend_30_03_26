/**
 * Debug script to check tables and areas data
 * Run: node scripts/debugTablesAndAreas.js
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const DB_URL = process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5432/brewwlabs';
const BUSINESS_ID = '2cda9723-2886-4d4d-9479-b4d22c875ce6';
const OUTLET_ID = '3f3915df-9a01-495c-a7a0-58ce2759d251';

async function debugTablesAndAreas() {
  const sequelize = new Sequelize(DB_URL, { logging: false });
  
  console.log('\n🔍 TABLES & AREAS DEBUG\n');
  console.log('Business ID:', BUSINESS_ID);
  console.log('Outlet ID:', OUTLET_ID);
  console.log('Schema: tenant_' + BUSINESS_ID);
  
  try {
    // 1. Check if tables exist
    console.log('\n📊 1. TABLES in tenant schema...');
    const [tables] = await sequelize.query(`
      SELECT COUNT(*) as count, 
             COUNT(CASE WHEN outlet_id = '${OUTLET_ID}' THEN 1 END) as outlet_tables
      FROM "tenant_${BUSINESS_ID}".tables
    `);
    console.log('   Total tables:', tables[0].count);
    console.log('   Tables for this outlet:', tables[0].outlet_tables);

    // 2. Check if table_areas exist
    console.log('\n📊 2. AREAS (table_areas) in tenant schema...');
    const [areas] = await sequelize.query(`
      SELECT COUNT(*) as count,
             COUNT(CASE WHEN outlet_id = '${OUTLET_ID}' THEN 1 END) as outlet_areas
      FROM "tenant_${BUSINESS_ID}".table_areas
    `);
    console.log('   Total areas:', areas[0].count);
    console.log('   Areas for this outlet:', areas[0].outlet_areas);

    // 3. Sample tables
    if (tables[0].count > 0) {
      console.log('\n📊 3. Sample tables...');
      const [sampleTables] = await sequelize.query(`
        SELECT id, table_no, name, area_id, outlet_id, status
        FROM "tenant_${BUSINESS_ID}".tables
        LIMIT 5
      `);
      console.log('   Tables:', sampleTables);
    }

    // 4. Sample areas
    if (areas[0].count > 0) {
      console.log('\n📊 4. Sample areas...');
      const [sampleAreas] = await sequelize.query(`
        SELECT id, name, outlet_id, status
        FROM "tenant_${BUSINESS_ID}".table_areas
        LIMIT 5
      `);
      console.log('   Areas:', sampleAreas);
    }

    // 5. Summary
    console.log('\n📋 SUMMARY:');
    if (tables[0].count === 0 && areas[0].count === 0) {
      console.log('   ❌ No tables OR areas exist. You need to create both.');
      console.log('   👉 First create AREAS at: /admin/table-areas');
      console.log('   👉 Then create TABLES at: /admin/tables');
    } else if (tables[0].count === 0) {
      console.log('   ⚠️ Areas exist but no tables. Create tables at: /admin/tables');
    } else if (areas[0].count === 0) {
      console.log('   ⚠️ Tables exist but no areas. Create areas at: /admin/table-areas');
    } else {
      console.log('   ✅ Both tables and areas exist!');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await sequelize.close();
    console.log('\n✅ Debug complete\n');
  }
}

debugTablesAndAreas();
