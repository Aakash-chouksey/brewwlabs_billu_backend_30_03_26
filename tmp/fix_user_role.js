const db = require('../control_plane_models'); 

async function fixUserRole(email) {
  try {
    await db.init();
    const User = db.User;

    const user = await User.findOne({ 
      where: { email }
    }); 
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`🛠️ Fixing role for User: ${user.email}, Old Role: ${user.role}`);

    // Update role to BusinessAdmin as expected by frontend
    await User.update({
        role: 'BusinessAdmin',
        panelType: 'TENANT',
        status: 'ACTIVE'
    }, { where: { id: user.id } });
    
    console.log(`✅ User role updated to BusinessAdmin`);

  } catch (err) {
    console.error('🔥 Error fixing user role:', err);
  } finally {
    process.exit(0);
  }
}

fixUserRole('abhilashpatel112@gmail.com');
