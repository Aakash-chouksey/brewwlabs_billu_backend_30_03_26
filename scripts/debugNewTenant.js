/**
 * Debug script to check tables for the NEW tenant
 * Run: node scripts/debugNewTenant.js
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const DB_URL = process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5432/brewwlabs';

// The tenant from the error message
const BUSINESS_ID = 'a82c81e7-ac94-4e9a-8b81-d0c8321ed5fd';

async function debugNewTenant() {
  const sequelize = new Sequelize(DB_URL, { logging: false });
  
  console.log('\n🔍 NEW TENANT DEBUG\n');
  console.log('Business ID from error:', BUSINESS_ID);
  console.log('Schema: tenant_' + BUSINESS_ID);
  
  try {
    // Check if this schema exists
    const [schemas] = await sequelize.query(`
      SELECT schema_name FROM information_schema.schemata 
      WHERE schema_name = 'tenant_${BUSINESS_ID}'
    `);
    
    if (schemas.length === 0) {
      console.log('\n❌ Schema does NOT exist!');
      console.log('   This tenant has not been properly onboarded.');
      return;
    }
    
    console.log('\n✅ Schema exists');
    
    // Check tables
    console.log('\n📊 Tables in this tenant...');
    const [tables] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM "tenant_${BUSINESS_ID}".tables
    `);
    console.log('   Total tables:', tables[0].count);
    
    // Check areas
    console.log('\n📊 Areas in this tenant...');
    const [areas] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM "tenant_${BUSINESS_ID}".table_areas
    `);
    console.log('   Total areas:', areas[0].count);
    
    // Check outlets
    console.log('\n📊 Outlets in this tenant...');
    const [outlets] = await sequelize.query(`
      SELECT id, name FROM "tenant_${BUSINESS_ID}".outlets
    `);
    console.log('   Outlets:', outlets);
    
    if (areas[0].count === 0) {
      console.log('\n⚠️  NO AREAS exist!');
      console.log('   👉 You must create areas FIRST at: /admin/table-areas');
    }
    
    if (tables[0].count === 0) {
      console.log('\n⚠️  NO TABLES exist!');
      console.log('   👉 Create tables at: /admin/tables');
      console.log('   ⚠️  You will get "Table number is required" error if:');
      console.log('       1. Table Number field is empty');
      console.log('       2. Table Number only contains spaces');
      console.log('       3. The request bypasses frontend validation');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await sequelize.close();
    console.log('\n✅ Debug complete\n');
  }
}

debugNewTenant();
