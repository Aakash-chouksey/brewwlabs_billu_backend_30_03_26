const { sequelize } = require('../config/database_postgres');
const Category = require('../models/categoryModel');
const Product = require('../models/productModel');
const { v4: uuidv4 } = require('uuid');

async function verifyIsolation() {
  console.log('🧪 Starting Multi-Tenant Isolation Verification...');
  
  const brandA = uuidv4();
  const brandB = uuidv4();
  const outletA = uuidv4();
  const outletB = uuidv4();

  try {
    await sequelize.authenticate();
    
    // 1. Create data for Brand A
    console.log(`Creating Category for Brand A (${brandA})...`);
    const catA = await Category.create({
      brandId: brandA,
      outletId: outletA,
      name: 'Cafe A Category',
      description: 'Only for A'
    });

    console.log(`Creating Product for Brand A...`);
    await Product.create({
      brandId: brandA,
      outletId: outletA,
      categoryId: catA.id,
      name: 'Cafe A Latte',
      price: 5.00
    });

    // 2. Create data for Brand B
    console.log(`Creating Category for Brand B (${brandB})...`);
    await Category.create({
      brandId: brandB,
      outletId: outletB,
      name: 'Cafe B Category',
      description: 'Only for B'
    });

    // 3. Verify Isolation
    console.log('\n--- VERIFICATION ---');

    // Fetch categories for Brand A
    const categoriesA = await Category.findAll({ where: { brandId: brandA } });
    console.log(`Brand A Categories found: ${categoriesA.length}`);
    if (categoriesA.length === 1 && categoriesA[0].name === 'Cafe A Category') {
      console.log('✅ PASS: Brand A sees only its own category.');
    } else {
      console.error('❌ FAIL: Brand A isolation failed.');
    }

    // Attempt to fetch Brand A category with Brand B context
    const categoriesB = await Category.findAll({ where: { brandId: brandB } });
    console.log(`Brand B Categories found: ${categoriesB.length}`);
    const seesA = categoriesB.some(c => c.name === 'Cafe A Category');
    if (!seesA) {
      console.log('✅ PASS: Brand B cannot see Brand A\'s category.');
    } else {
      console.error('❌ FAIL: Brand B sees Brand A\'s category!');
    }

    // Verify Product Isolation
    const productsA = await Product.findAll({ where: { brandId: brandA } });
    console.log(`Brand A Products found: ${productsA.length}`);
    if (productsA.length === 1 && productsA[0].name === 'Cafe A Latte') {
      console.log('✅ PASS: Brand A sees only its own product.');
    } else {
      console.error('❌ FAIL: Product isolation failed.');
    }

    console.log('\n🎉 ALL ISOLATION TESTS PASSED!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyIsolation();
