
const { sequelize, connectUnifiedDB } = require('./config/unified_database');
const { ModelFactory } = require('./src/architecture/modelFactory');

async function checkTenantOutlets() {
    try {
        await connectUnifiedDB();
        const models = await ModelFactory.createModels(sequelize);
        const { User, Outlet } = models;

        const email = 'aakash@admin.com';
        const user = await User.findOne({ where: { email } });

        if (!user) {
            console.log(`❌ User ${email} not found`);
            process.exit(1);
        }

        const schemaName = `tenant_${user.businessId}`;
        console.log(`🔍 Checking schema: ${schemaName}`);

        // Check if outlet exists in tenant schema
        const outlet = await Outlet.schema(schemaName).findByPk(user.outletId);

        if (outlet) {
            console.log('✅ OUTLET FOUND IN TENANT SCHEMA:');
            console.log(JSON.stringify(outlet.toJSON(), null, 2));
        } else {
            console.log('❌ OUTLET NOT FOUND IN TENANT SCHEMA!');
            
            // List all outlets in that schema
            const allOutlets = await Outlet.schema(schemaName).findAll();
            console.log(`\n📋 All outlets in ${schemaName}:`);
            console.log(JSON.stringify(allOutlets.map(o => o.toJSON()), null, 2));
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkTenantOutlets();
