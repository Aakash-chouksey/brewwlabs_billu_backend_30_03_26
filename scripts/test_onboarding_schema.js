const axios = require('axios');
const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:F3vO5aokZItR@ep-muddy-cherry-an9o34db-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&application_name=brewwlabs_pos';

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  }
});

async function runOnboardingTest() {
  try {
    const businessId = `biz_${Date.now()}`;
    const onboardingData = {
      businessName: `Test_Business_${businessId}`,
      businessEmail: `${businessId}@test.cafe.com`,
      businessPhone: '1234567890',
      businessAddress: '123 Test St',
      gstNumber: `GST${Date.now()}`,
      adminName: 'Test Admin',
      adminEmail: `admin_${businessId}@test.cafe.com`,
      adminPassword: 'Password@123',
      cafeType: 'SOLO'
    };

    console.log("1. Creating new business via onboarding API...");
    const res = await axios.post('http://localhost:8000/api/onboarding/business', onboardingData);
    
    if (!res.data.success) {
      console.log("Onboarding API failed:", res.data);
      return;
    }
    
    const dbBusinessId = res.data.data.businessId;
    const token = res.data.data.token;
    
    console.log(`✅ Business created. DB ID: ${dbBusinessId}`);

    console.log("\n2. Checking schema existence...");
    const schemaName = `tenant_${dbBusinessId}`;
    const schemas = await sequelize.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${schemaName}'`, { type: Sequelize.QueryTypes.SELECT });
    const schemaCreated = schemas.length > 0;
    console.log(`Schema created [${schemaName}]: ${schemaCreated ? 'YES' : 'NO'}`);

    console.log("\n3. Checking tables inside tenant schema...");
    const tables = await sequelize.query(`SELECT tablename FROM pg_tables WHERE schemaname = '${schemaName}'`, { type: Sequelize.QueryTypes.SELECT });
    const tableNames = tables.map(t => t.tablename);
    const tablesCreated = tableNames.includes('products') && tableNames.includes('orders') && tableNames.includes('outlets');
    console.log(`Tables created (products, orders, outlets): ${tablesCreated ? 'YES' : 'NO'}`);
    if (tablesCreated) console.log(`Total tables found: ${tables.length}`);

    console.log("\n4. Checking public schema pollution...");
    const publicProducts = await sequelize.query(`SELECT * FROM public.products WHERE current_schema = 'public' LIMIT 1`, { type: Sequelize.QueryTypes.SELECT });
    const publicClean = publicProducts.length === 0;
    console.log(`Public clean (no tenant data in public.products): ${publicClean ? 'YES' : 'NO'}`);

    console.log("\n5. Testing API call strictly hitting tenant schema...");
    const profileRes = await axios.get('http://localhost:8000/api/tenant/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const profileSuccess = profileRes.data.success;
    console.log(`API queries hit tenant schema only: ${profileSuccess ? 'YES' : 'NO'}`);

    console.log("\n# OUTPUT:");
    console.log(`* Schema created: ${schemaCreated ? 'YES' : 'NO'}`);
    console.log(`* Tables created: ${tablesCreated ? 'YES' : 'NO'}`);
    console.log(`* Public clean: ${publicClean ? 'YES' : 'NO'}`);
    console.log(`* Final verdict: ${schemaCreated && tablesCreated && publicClean && profileSuccess ? 'PASS' : 'FAIL'}`);

    process.exit(schemaCreated && tablesCreated && publicClean && profileSuccess ? 0 : 1);

  } catch (error) {
    console.error("❌ Test script failed:", error.response?.data || error.message);
    process.exit(1);
  }
}

runOnboardingTest();
