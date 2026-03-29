const { sequelize, connectUnifiedDB } = require('./config/unified_database');
const { ModelFactory } = require('./src/architecture/modelFactory');

async function inspect() {
    try {
        await connectUnifiedDB();
        const models = await ModelFactory.createModels(sequelize);
        const { User, Business, TenantRegistry } = models;

        const email = 'aakash@admin.com';
        const user = await User.findOne({ where: { email } });

        if (!user) {
            console.log(`❌ User ${email} not found`);
            process.exit(1);
        }

        console.log('\n👤 USER DETAILS:');
        console.log(JSON.stringify({
            id: user.id,
            email: user.email,
            status: user.status,
            role: user.role,
            businessId: user.businessId,
            outletId: user.outletId,
            outletIds: user.outletIds,
            isActive: user.isActive,
            isVerified: user.isVerified
        }, null, 2));

        const business = await Business.findByPk(user.businessId);
        if (business) {
            console.log('\n🏢 BUSINESS DETAILS:');
            console.log(JSON.stringify({
                id: business.id,
                name: business.name,
                status: business.status,
                isActive: business.isActive
            }, null, 2));
        }

        const registry = await TenantRegistry.findOne({ where: { business_id: user.businessId } });
        if (registry) {
            console.log('\n🔒 REGISTRY DETAILS:');
            console.log(JSON.stringify({
                id: registry.id,
                status: registry.status,
                schemaName: registry.schemaName
            }, null, 2));
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

inspect();
