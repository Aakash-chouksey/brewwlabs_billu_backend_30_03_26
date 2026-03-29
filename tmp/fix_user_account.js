const db = require('../control_plane_models'); 
const neonTransactionSafeExecutor = require('../services/neonTransactionSafeExecutor');
const { v4: uuidv4 } = require('uuid');

async function fixUserAccount(email) {
  try {
    await db.init();
    const User = db.User;
    const Business = db.Business;
    const TenantRegistry = db.TenantRegistry;
    const Subscription = db.Subscription;
    const Plan = db.Plan;

    const user = await User.findOne({ 
      where: { email }
    }); 
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    const businessId = user.businessId;
    console.log(`🛠️ Fixing account for User: ${user.email}, BusinessId: ${businessId}`);

    // 1. Ensure Business is active
    await Business.update({ status: 'active', isActive: true }, { where: { id: businessId } });
    console.log('✅ Business activated');

    // 2. Ensure Tenant Registry is ACTIVE
    await TenantRegistry.update({ status: 'ACTIVE' }, { where: { businessId: businessId } });
    console.log('✅ Tenant Registry activated');

    // 3. Ensure a Plan exists
    let trialPlan = await Plan.findOne({ where: { slug: 'free-trial' } });
    if (!trialPlan) {
        trialPlan = await Plan.create({
            id: uuidv4(),
            name: 'Free Trial',
            slug: 'free-trial',
            description: '30-day free trial plan',
            price: 0,
            billingCycle: 'MONTHLY',
            isActive: true,
            isPublic: false,
            trialDays: 30
        });
        console.log('✅ Trial Plan created');
    }

    // 4. Ensure Subscription exists
    let subscription = await Subscription.findOne({ where: { businessId } });
    if (!subscription) {
      subscription = await Subscription.create({
        id: uuidv4(),
        businessId,
        planId: trialPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
      console.log('✅ Subscription created');
    } else {
      console.log('ℹ️ Subscription already exists');
    }

    // 5. Check/Create Outlet in Tenant Schema
    const tenantId = businessId;
    const outletResult = await neonTransactionSafeExecutor.executeWithTenant(tenantId, async (context) => {
        const { transactionModels: models, transaction } = context;
        const { Outlet } = models;

        let outlet = await Outlet.findOne({ transaction });
        if (!outlet) {
            outlet = await Outlet.create({
                id: uuidv4(),
                businessId: tenantId,
                name: 'Main Outlet',
                address: 'Indore, MP',
                isActive: true,
                isHeadOffice: true
            }, { transaction });
            console.log('✅ Created default outlet in tenant schema');
        } else {
            console.log('ℹ️ Outlet already exists in tenant schema');
        }
        return outlet;
    });

    const outlet = outletResult.data || outletResult;

    // 6. Update User with Outlet Assignment
    await User.update({
        outletId: outlet.id,
        outletIds: [outlet.id],
        status: 'ACTIVE'
    }, { where: { id: user.id } });
    console.log(`✅ User assigned to outlet: ${outlet.id}`);

    console.log('🚀 Account fix completed successfully!');
  } catch (err) {
    console.error('🔥 Error fixing user account:', err);
  } finally {
    process.exit(0);
  }
}

fixUserAccount('abhilashpatel112@gmail.com');
