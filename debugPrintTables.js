/**
 * Debug Script: Print all user tables and data
 * Run with: node debugPrintTables.js
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
});

async function printTables() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // 1. Print all users
    console.log('========================================');
    console.log('1. USERS TABLE - All users');
    console.log('========================================');
    const users = await sequelize.query(`
      SELECT id, email, name, role, business_id, outlet_id, outlet_ids, status, is_active, is_verified, panel_type 
      FROM public.users
    `, { type: Sequelize.QueryTypes.SELECT });
    console.table(users);

    // 2. Print businesses
    console.log('\n========================================');
    console.log('2. BUSINESSES TABLE');
    console.log('========================================');
    const businesses = await sequelize.query(`
      SELECT id, name, status, is_active, owner_id, type 
      FROM public.businesses
    `, { type: Sequelize.QueryTypes.SELECT });
    console.table(businesses);

    // 3. Print tenant registry
    console.log('\n========================================');
    console.log('3. TENANT REGISTRY');
    console.log('========================================');
    const tenants = await sequelize.query(`
      SELECT id, business_id, schema_name, status, activated_at 
      FROM public.tenant_registry
    `, { type: Sequelize.QueryTypes.SELECT });
    console.table(tenants);

    // 4. Print specific user details
    console.log('\n========================================');
    console.log('4. SPECIFIC USER DETAILS');
    console.log('========================================');
    
    const emails = ['abhilashpatel112@gmail.com', 'billucafe10@cafe.com', 'billacafe10@cafe.com', 'atmosphere@cafe.com'];
    for (const email of emails) {
      console.log(`\n--- User: ${email} ---`);
      const user = await sequelize.query(`
        SELECT * FROM public.users WHERE email = '${email}'
      `, { type: Sequelize.QueryTypes.SELECT });
      if (user.length > 0) {
        console.log('FOUND:');
        console.table(user);
      } else {
        console.log('NOT FOUND');
      }
    }

    // 5. Print subscriptions
    console.log('\n========================================');
    console.log('5. SUBSCRIPTIONS');
    console.log('========================================');
    const subscriptions = await sequelize.query(`
      SELECT id, business_id, plan_id, status, billing_cycle, current_period_start, current_period_end
      FROM public.subscriptions
    `, { type: Sequelize.QueryTypes.SELECT });
    console.table(subscriptions);

    // 6. Print outlets from tenant schemas
    console.log('\n========================================');
    console.log('6. OUTLETS (in tenant schemas)');
    console.log('========================================');
    const schemas = await sequelize.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
    `, { type: Sequelize.QueryTypes.SELECT });
    
    for (const schema of schemas) {
      console.log(`\nSchema: ${schema.schema_name}`);
      try {
        const outlets = await sequelize.query(`
          SELECT id, name, business_id, status, is_active 
          FROM "${schema.schema_name}".outlets
        `, { type: Sequelize.QueryTypes.SELECT });
        if (outlets.length > 0) {
          console.table(outlets);
        } else {
          console.log('  (No outlets in this schema)');
        }
      } catch (e) {
        console.log(`  Error: ${e.message}`);
      }
    }

    console.log('\n========================================');
    console.log('DEBUG COMPLETE');
    console.log('========================================');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

printTables();
