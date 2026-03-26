/**
 * Debug Script for Item Addition Issues
 * This script will help identify why items are not being added to the database
 */

const { sequelize } = require('../../config/database_postgres');
const getModelsForRequest = require('./middlewares/modelInjection');

async function debugItemAddition() {
  console.log('🔍 Starting Item Addition Debug Process...\n');

  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful');

    // Get models (simulate a request context)
    const mockRequest = {
      businessId: 'test-business-id',
      outletId: 'test-outlet-id',
      auth: { role: 'BusinessAdmin' }
    };

    const models = await getModelsForRequest(mockRequest);
    console.log('✅ Models loaded successfully');

    // Check existing data
    console.log('\n📊 Checking existing data...');
    
    // Check categories
    const categories = await models.Category.findAll({
      where: { businessId: mockRequest.businessId }
    });
    console.log(`📁 Categories found: ${categories.length}`);
    categories.forEach(cat => console.log(`  - ${cat.name} (${cat.id})`));

    // Check products
    const products = await models.Product.findAll({
      where: { businessId: mockRequest.businessId }
    });
    console.log(`📦 Products found: ${products.length}`);
    products.forEach(prod => console.log(`  - ${prod.name} (${prod.id})`));

    // Check inventory items
    const inventoryItems = await models.InventoryItem.findAll({
      where: { businessId: mockRequest.businessId }
    });
    console.log(`📋 Inventory Items found: ${inventoryItems.length}`);
    inventoryItems.forEach(item => console.log(`  - ${item.name} (${item.id})`));

    // Test adding a category
    console.log('\n🧪 Testing category addition...');
    try {
      const testCategory = await models.Category.create({
        name: `Test Category ${Date.now()}`,
        description: 'Test category for debugging',
        businessId: mockRequest.businessId,
        outletId: mockRequest.outletId,
        color: '#3B82F6',
        sortOrder: 0
      });
      console.log('✅ Category created successfully:', testCategory.name);
      
      // Clean up
      await testCategory.destroy();
      console.log('🧹 Test category cleaned up');
    } catch (error) {
      console.error('❌ Category creation failed:', error.message);
      console.error('Error details:', error);
    }

    // Test adding a product
    console.log('\n🧪 Testing product addition...');
    if (categories.length > 0) {
      try {
        const testProduct = await models.Product.create({
          name: `Test Product ${Date.now()}`,
          categoryId: categories[0].id,
          price: 99.99,
          businessId: mockRequest.businessId,
          outletId: mockRequest.outletId,
          isAvailable: true,
          currentStock: 10
        });
        console.log('✅ Product created successfully:', testProduct.name);
        
        // Clean up
        await testProduct.destroy();
        console.log('🧹 Test product cleaned up');
      } catch (error) {
        console.error('❌ Product creation failed:', error.message);
        console.error('Error details:', error);
      }
    } else {
      console.log('⚠️ No categories available to test product creation');
    }

    // Test adding an inventory item
    console.log('\n🧪 Testing inventory item addition...');
    try {
      const testInventoryItem = await models.InventoryItem.create({
        name: `Test Inventory Item ${Date.now()}`,
        inventoryCategoryId: categories.length > 0 ? categories[0].id : null,
        businessId: mockRequest.businessId,
        outletId: mockRequest.outletId,
        currentStock: 50,
        minimumStock: 5,
        unit: 'pcs',
        costPerUnit: 10.00
      });
      console.log('✅ Inventory item created successfully:', testInventoryItem.name);
      
      // Clean up
      await testInventoryItem.destroy();
      console.log('🧹 Test inventory item cleaned up');
    } catch (error) {
      console.error('❌ Inventory item creation failed:', error.message);
      console.error('Error details:', error);
    }

    // Check database constraints
    console.log('\n🔍 Checking database constraints...');
    
    const [productConstraints] = await sequelize.query(`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        tc.table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name 
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = 'products'
        AND tc.constraint_type = 'UNIQUE'
    `);
    
    console.log('📦 Product constraints:');
    productConstraints.forEach(constraint => {
      console.log(`  - ${constraint.constraint_name}: ${constraint.column_name}`);
    });

    const [inventoryConstraints] = await sequelize.query(`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        tc.table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name 
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = 'inventory_items'
        AND tc.constraint_type = 'UNIQUE'
    `);
    
    console.log('📋 Inventory item constraints:');
    inventoryConstraints.forEach(constraint => {
      console.log(`  - ${constraint.constraint_name}: ${constraint.column_name}`);
    });

  } catch (error) {
    console.error('❌ Debug process failed:', error);
  } finally {
    await sequelize.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the debug process
debugItemAddition().catch(console.error);
