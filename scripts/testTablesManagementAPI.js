require('dotenv').config();
const { sequelize } = require('../config/database_postgres');
const Table = require('../models/tableModel');
const Area = require('../models/areaModel');

async function testTablesManagementAPI() {
  try {
    console.log('🔧 Testing Tables Management API...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Get a sample tenant context
    const [outletData] = await sequelize.query(`
      SELECT DISTINCT brand_id, id as outlet_id 
      FROM outlets 
      LIMIT 1
    `);
    
    if (outletData.length === 0) {
      console.log('❌ No outlets found in database');
      return;
    }
    
    const { brand_id, outlet_id } = outletData[0];
    console.log('🔍 Using sample outlet:', { brand_id, outlet_id });
    
    // Check existing areas
    const existingAreas = await Area.findAll({
      where: { brandId: brand_id, outletId: outlet_id }
    });
    
    console.log(`📊 Existing areas: ${existingAreas.length}`);
    
    if (existingAreas.length === 0) {
      console.log('📝 Creating a test area...');
      
      // Create a test area
      const testArea = await Area.create({
        name: 'Test Area',
        description: 'Test area for tables',
        capacity: 20,
        layout: 'square',
        status: 'active',
        brandId: brand_id,
        outletId: outlet_id
      });
      
      console.log('✅ Test area created:', testArea.id);
      existingAreas.push(testArea);
    } else {
      console.log('✅ Using existing area:', existingAreas[0].name);
    }
    
    const testArea = existingAreas[0];
    
    // Test table creation scenarios
    console.log('\n🔍 Testing table creation scenarios...');
    
    // Test 1: Create a valid table
    console.log('\n📝 Test 1: Create a valid table');
    try {
      const table1 = await Table.create({
        name: 'Table 1',
        tableNo: 'T001',
        capacity: 4,
        areaId: testArea.id,
        shape: 'square',
        status: 'Available',
        brandId: brand_id,
        outletId: outlet_id
      });
      
      console.log('✅ Test 1 passed - Table created:', table1.id);
      
    } catch (error) {
      console.log('❌ Test 1 failed:', error.message);
    }
    
    // Test 2: Create table without area (should work)
    console.log('\n📝 Test 2: Create table without area');
    try {
      const table2 = await Table.create({
        name: 'Table 2',
        tableNo: 'T002',
        capacity: 2,
        shape: 'round',
        status: 'Available',
        brandId: brand_id,
        outletId: outlet_id
      });
      
      console.log('✅ Test 2 passed - Table created without area:', table2.id);
      
    } catch (error) {
      console.log('❌ Test 2 failed:', error.message);
    }
    
    // Test 3: Create table with invalid data (should fail)
    console.log('\n📝 Test 3: Create table with invalid data (missing name)');
    try {
      const table3 = await Table.create({
        tableNo: 'T003',
        capacity: 4,
        shape: 'square',
        status: 'Available',
        brandId: brand_id,
        outletId: outlet_id
      });
      
      console.log('❌ Test 3 unexpectedly passed - this should have failed');
      
    } catch (error) {
      if (error.message.includes('notNull') && error.message.includes('name')) {
        console.log('✅ Test 3 passed - Correctly rejected missing name');
      } else {
        console.log('❌ Test 3 failed with unexpected error:', error.message);
      }
    }
    
    // Test 4: Create table with invalid capacity (should fail)
    console.log('\n📝 Test 4: Create table with invalid capacity');
    try {
      const table4 = await Table.create({
        name: 'Table 4',
        tableNo: 'T004',
        capacity: -1,
        shape: 'square',
        status: 'Available',
        brandId: brand_id,
        outletId: outlet_id
      });
      
      console.log('❌ Test 4 unexpectedly passed - this should have failed');
      
    } catch (error) {
      console.log('✅ Test 4 passed - Correctly rejected invalid capacity:', error.message);
    }
    
    // Test 5: Update table status
    console.log('\n📝 Test 5: Update table status');
    try {
      const existingTable = await Table.findOne({
        where: { brandId: brand_id, outletId: outlet_id }
      });
      
      if (existingTable) {
        await existingTable.update({ status: 'Occupied' });
        console.log('✅ Test 5 passed - Table status updated to:', existingTable.status);
      } else {
        console.log('❌ Test 5 failed - No existing table to update');
      }
      
    } catch (error) {
      console.log('❌ Test 5 failed:', error.message);
    }
    
    // Show all tables
    console.log('\n📋 All tables created:');
    const allTables = await Table.findAll({
      where: { brandId: brand_id, outletId: outlet_id },
      attributes: ['id', 'name', 'tableNo', 'capacity', 'areaId', 'shape', 'status', 'createdAt'],
      include: [
        {
          model: Area,
          as: 'area',
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    allTables.forEach(table => {
      const areaName = table.area ? table.area.name : 'No Area';
      console.log(`  - ${table.name} (${table.tableNo}): ${table.capacity} seats, ${table.shape}, ${table.status}, Area: ${areaName}`);
    });
    
    console.log('\n🎉 Tables Management API testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testTablesManagementAPI();
