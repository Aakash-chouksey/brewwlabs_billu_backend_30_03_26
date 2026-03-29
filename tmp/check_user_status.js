const db = require('../control_plane_models'); 

async function checkUser(email) {
  try {
    await db.init();
    const User = db.User;
    const Business = db.Business;
    const TenantRegistry = db.TenantRegistry;
    const Subscription = db.Subscription;

    if (!User) {
        throw new Error('User model still undefined after init');
    }

    const user = await User.findOne({ 
      where: { email }, 
      include: [{ model: Business, as: 'business' }] 
    }); 
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    const business = user.business;
    const registry = await TenantRegistry.findOne({ where: { businessId: user.businessId } });
    const subscription = await Subscription.findOne({ where: { businessId: user.businessId } });
    
    console.log(JSON.stringify({ 
      user: user.toJSON(), 
      business: business ? business.toJSON() : null, 
      registry: registry ? registry.toJSON() : null, 
      subscription: subscription ? subscription.toJSON() : null 
    }, null, 2));
  } catch (err) {
    console.error('🔥 Error checking user:', err);
  } finally {
    process.exit(0);
  }
}

checkUser('abhilashpatel112@gmail.com');
