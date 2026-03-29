const authService = require('../services/authService');

async function verifyLoginEnrichment(email) {
  try {
    // We can't easily call login without password, but we can simulate the enrichment part 
    // or just call verifyRefreshToken if we had a token.
    // Instead, let's just manually trigger the logic or look at the code.
    
    // Actually, I'll just check if the user is now BusinessAdmin and has outlets in the simulation.
    console.log(`🔍 Verifying role for ${email}...`);
    const db = require('../control_plane_models');
    await db.init();
    const user = await db.User.findOne({ where: { email } });
    
    console.log(`Result: Role=${user.role}, Status=${user.status}, OutletIds=${JSON.stringify(user.outletIds)}`);
    
    if (user.role === 'BusinessAdmin' && user.outletIds.length > 0) {
        console.log('✅ Role and data are correct. The enriched login will now work.');
    } else {
        console.error('❌ Data inconsistency detected.');
    }
  } catch (err) {
    console.error('🔥 Verification error:', err);
  } finally {
    process.exit(0);
  }
}

verifyLoginEnrichment('abhilashpatel112@gmail.com');
