const bcrypt = require('bcrypt');
const { sequelize } = require('../config/database_postgres');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { v4: uuidv4 } = require('uuid');

async function createSuperAdminCredentials() {
  try {
    console.log('🔧 Creating SuperAdmin credentials...');

    // SuperAdmin credentials
    const superAdminEmail = 'admin@brewwlabs.com';
    const superAdminPassword = 'Admin@123456';
    const saltRounds = 12;

    // Hash the password
    const passwordHash = await bcrypt.hash(superAdminPassword, saltRounds);

    // Check if SuperAdmin already exists
    const [existingUsers] = await sequelize.query(`
      SELECT id, email FROM users WHERE email = :email AND role = 'SUPER_ADMIN'
    `, {
      replacements: { email: superAdminEmail }
    });

    let userId;
    if (existingUsers.length > 0) {
      console.log('✅ SuperAdmin already exists:', existingUsers[0]);
      userId = existingUsers[0].id;
      
      // Update password
      await sequelize.query(`
        UPDATE users 
        SET "password_hash" = :passwordHash, "tokenVersion" = 0, status = 'active'
        WHERE email = :email AND role = 'SUPER_ADMIN'
      `, {
        replacements: { email: superAdminEmail, passwordHash }
      });
      
      console.log('🔄 Updated SuperAdmin password');
    } else {
      // Create new SuperAdmin
      const newUserId = uuidv4();
      const [newUser] = await sequelize.query(`
        INSERT INTO users (id, email, name, "password_hash", role, "businessId", "tokenVersion", status, "createdAt", "updatedAt")
        VALUES (:id, :email, :name, :passwordHash, 'SUPER_ADMIN', :businessId, 0, 'active', NOW(), NOW())
        RETURNING id, email, role, status
      `, {
        replacements: { id: newUserId, email: superAdminEmail, name: 'Super Admin', passwordHash, businessId: '00000000-0000-0000-0000-000000000000' }
      });

      userId = newUser[0].id;
      console.log('✅ Created new SuperAdmin:', newUser[0]);
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
    console.log('🔑 Password: [REDACTED FOR SECURITY]');
    console.log('🎫 Role: SUPER_ADMIN');
    console.log('🏷️  Panel Type: ADMIN');
    console.log('🔗 Test Token: [REDACTED FOR SECURITY]');
    console.log('\n📝 Use these credentials to login to pos-admin at http://localhost:5176');

    return { email: superAdminEmail, password: superAdminPassword, token: accessToken };
  } catch (error) {
    console.error('❌ Error creating SuperAdmin:', error.message);
    throw error;
  }
}

module.exports = { createSuperAdminCredentials };
