
const { sequelize, connectUnifiedDB } = require('../config/unified_database');
const { ModelFactory } = require('../src/architecture/modelFactory');

async function approveUser(email) {
    if (!email) {
        console.error('❌ Email is required');
        process.exit(1);
    }

    try {
        await connectUnifiedDB();
        const models = await ModelFactory.createModels(sequelize);
        const { User, Business, TenantRegistry } = models;

        const user = await User.findOne({ where: { email } });

        if (!user) {
            console.log(`❌ User ${email} not found`);
            process.exit(1);
        }

        console.log(`🚀 Approving user: ${user.email} (ID: ${user.id})`);

        // 1. Update User status to ACTIVE
        await user.update({ 
            status: 'ACTIVE',
            isVerified: true,
            isActive: true 
        });
        console.log('✅ User status updated to ACTIVE');

        // 2. Update Business status to active
        const business = await Business.findByPk(user.businessId);
        if (business) {
            await business.update({ status: 'active', isActive: true });
            console.log(`✅ Business "${business.name}" status updated to active`);
        }

        // 3. Update TenantRegistry status to ACTIVE
        const registry = await TenantRegistry.findOne({ where: { business_id: user.businessId } });
        if (registry) {
            await registry.update({ status: 'ACTIVE' });
            console.log('✅ Tenant Registry status updated to ACTIVE');
        }

        console.log(`🎉 User ${email} successfully approved for platform access!`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error approving user:', error);
        process.exit(1);
    }
}

// Get email from command line argument
const emailArg = process.argv[2] || 'aakash@admin.com';
approveUser(emailArg);
