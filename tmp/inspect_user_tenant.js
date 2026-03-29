const neonTransactionSafeExecutor = require('../services/neonTransactionSafeExecutor');

async function inspectUserTenant(businessId, email) {
  try {
    const result = await neonTransactionSafeExecutor.readWithTenant(businessId, async (context) => {
        const { User } = context.transactionModels;
        return await User.findOne({ where: { email } });
    });
    
    console.log(JSON.stringify(result.data, null, 2));
  } catch (err) {
    console.error('🔥 Error inspecting tenant user:', err);
  } finally {
    process.exit(0);
  }
}

inspectUserTenant('a82c81e7-ac94-4e9a-8b81-d0c8321ed5fd', 'abhilashpatel112@gmail.com');
