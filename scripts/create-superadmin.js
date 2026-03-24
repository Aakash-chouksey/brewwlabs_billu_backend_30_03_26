// Load environment variables first
require('dotenv').config();

const bcrypt = require('bcrypt');
const { controlPlaneSequelize } = require('../config/control_plane_db');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { v4: uuidv4 } = require('uuid');

async function createSuperAdminCredentials() {
  try {
    console.log('🔧 Creating SuperAdmin credentials in control plane database...');

    // SuperAdmin credentials
    const superAdminEmail = 'admin@brewwlabs.com';
    const superAdminPassword = 'Admin@123456';
    const saltRounds = 12;

    // Hash the password
    const passwordHash = await bcrypt.hash(superAdminPassword, saltRounds);

    // Check if SuperAdmin already exists in control plane
    const [existingUsers] = await controlPlaneSequelize.query(`
      SELECT id, email FROM super_admin_users WHERE email = :email
    `, {
      replacements: { email: superAdminEmail }
    });

    let userId;
    if (existingUsers.length > 0) {
      console.log('✅ SuperAdmin already exists in control plane:', existingUsers[0]);
      userId = existingUsers[0].id;
      
      // Update password
      await controlPlaneSequelize.query(`
        UPDATE super_admin_users 
        SET "password_hash" = :passwordHash, updated_at = NOW()
        WHERE email = :email
      `, {
        replacements: { email: superAdminEmail, passwordHash }
      });
      
      console.log('🔄 Updated SuperAdmin password in control plane');
    } else {
      // Create new SuperAdmin in control plane
      const newUserId = uuidv4();
      const [newUser] = await controlPlaneSequelize.query(`
        INSERT INTO super_admin_users (id, email, password_hash, role, created_at, updated_at)
        VALUES (:id, :email, :passwordHash, 'SUPER_ADMIN', NOW(), NOW())
        RETURNING id, email, role
      `, {
        replacements: { id: newUserId, email: superAdminEmail, passwordHash }
      });

      userId = newUser[0].id;
      console.log('✅ Created new SuperAdmin in control plane:', newUser[0]);
    }

    // Generate test token
    const testUser = {
      id: userId,
      email: superAdminEmail,
      role: 'SUPER_ADMIN',
      businessId: null,
      tokenVersion: 0
    };

    const tokenPayload = {
      id: testUser.id,
      email: testUser.email,
      role: testUser.role,
      businessId: testUser.businessId,
      tokenVersion: testUser.tokenVersion,
      panelType: 'ADMIN'
    };

    const accessToken = jwt.sign(tokenPayload, config.accessTokenSecret, { expiresIn: '1h' });

    console.log('\n🎯 SuperAdmin Credentials Created:');
    console.log('📧 Email:', superAdminEmail);
    console.log('🔑 Password:', superAdminPassword);
    console.log('🎫 Role: SUPER_ADMIN');
    console.log('🏷️  Panel Type: ADMIN');
    console.log('🔗 Test Token:', accessToken);
    console.log('\n📝 Use these credentials to login to pos-admin at http://localhost:5174');

    return { email: superAdminEmail, password: superAdminPassword, token: accessToken };
  } catch (error) {
    console.error('❌ Error creating SuperAdmin:', error.message);
    throw error;
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  createSuperAdminCredentials()
    .then(() => {
      console.log('✅ SuperAdmin setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ SuperAdmin setup failed:', error);
      process.exit(1);
    });
}

module.exports = { createSuperAdminCredentials };
