require('dotenv').config();
const { sequelize } = require('../config/database_postgres');
const ProductType = require('../models/productTypeModel');
const Category = require('../models/categoryModel');

async function verifyAndFixProductTypes() {
  try {
    console.log('🔧 Verifying and Fixing Product Types...');
    
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
    
    // Check existing product types
    const existingProductTypes = await ProductType.findAll({
      where: { brandId: brand_id, outletId: outlet_id }
    });
    
    console.log(`📊 Existing product types: ${existingProductTypes.length}`);
    
    if (existingProductTypes.length === 0) {
      console.log('📝 Creating default product types...');
      
      // Create default product types
      const defaultProductTypes = [
        { name: 'Food', description: 'Food items and dishes', icon: '🍽️', color: '#EF4444' },
        { name: 'Beverages', description: 'Drinks and liquids', icon: '🥤', color: '#3B82F6' },
        { name: 'Desserts', description: 'Sweet items and desserts', icon: '🍰', color: '#EC4899' },
        { name: 'Appetizers', description: 'Starters and appetizers', icon: '🥗', color: '#10B981' },
        { name: 'Main Course', description: 'Main dishes and entrees', icon: '🍖', color: '#F59E0B' }
      ];
      
      for (const productTypeData of defaultProductTypes) {
        await ProductType.create({
          ...productTypeData,
          brandId: brand_id,
          outletId: outlet_id
        });
      }
      
      console.log('✅ Default product types created');
    } else {
      console.log('✅ Product types already exist');
      existingProductTypes.forEach(pt => {
        console.log(`  - ${pt.name}: ${pt.description || 'No description'}`);
      });
    }
    
    // Check existing categories
    const existingCategories = await Category.findAll({
      where: { brandId: brand_id, outletId: outlet_id }
    });
    
    console.log(`📊 Existing categories: ${existingCategories.length}`);
    
    if (existingCategories.length === 0) {
      console.log('📝 Creating default categories...');
      
      // Create default categories
      const defaultCategories = [
        { name: 'Starters', description: 'Appetizers and starters' },
        { name: 'Main Course', description: 'Main dishes and entrees' },
        { name: 'Desserts', description: 'Sweet items and desserts' },
        { name: 'Beverages', description: 'Drinks and liquids' },
        { name: 'Snacks', description: 'Quick bites and snacks' }
      ];
      
      for (const categoryData of defaultCategories) {
        await Category.create({
          ...categoryData,
          brandId: brand_id,
          outletId: outlet_id
        });
      }
      
      console.log('✅ Default categories created');
    } else {
      console.log('✅ Categories already exist');
      existingCategories.forEach(cat => {
        console.log(`  - ${cat.name}: ${cat.description || 'No description'}`);
      });
    }
    
    // Verify the setup by testing the validation
    console.log('\n🔍 Testing validation setup...');
    
    const testProductType = await ProductType.findOne({
      where: { brandId: brand_id, outletId: outlet_id }
    });
    
    const testCategory = await Category.findOne({
      where: { brandId: brand_id, outletId: outlet_id }
    });
    
    if (testProductType && testCategory) {
      console.log('✅ Validation test passed:');
      console.log(`  - Product Type: ${testProductType.name} (${testProductType.id})`);
      console.log(`  - Category: ${testCategory.name} (${testCategory.id})`);
      console.log('✅ Product creation should now work!');
    } else {
      console.log('❌ Validation test failed - missing required data');
    }
    
    // Show all product types and categories for debugging
    console.log('\n📋 All Product Types:');
    const allProductTypes = await ProductType.findAll({
      where: { brandId: brand_id, outletId: outlet_id },
      attributes: ['id', 'name', 'description', 'brandId', 'outletId']
    });
    allProductTypes.forEach(pt => {
      console.log(`  - ${pt.name}: ${pt.id} (brand: ${pt.brandId}, outlet: ${pt.outletId})`);
    });
    
    console.log('\n📋 All Categories:');
    const allCategories = await Category.findAll({
      where: { brandId: brand_id, outletId: outlet_id },
      attributes: ['id', 'name', 'description', 'brandId', 'outletId']
    });
    allCategories.forEach(cat => {
      console.log(`  - ${cat.name}: ${cat.id} (brand: ${cat.brandId}, outlet: ${cat.outletId})`);
    });
    
    console.log('\n🎉 Product types and categories verification completed!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the verification
verifyAndFixProductTypes();
