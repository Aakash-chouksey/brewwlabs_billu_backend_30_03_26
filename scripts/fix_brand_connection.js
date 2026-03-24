require('dotenv').config();
const { controlPlaneSequelize } = require('../config/control_plane_db.js');
const { TenantConnection, Brand } = require('../control_plane_models');
const crypto = require('crypto');

async function fixBrandConnection() {
  try {
    console.log('🔧 Fixing tenant connection for brand: 7ac6261d-fca7-4277-a264-e68b69b9807e');
    
    const targetBrandId = '7ac6261d-fca7-4277-a264-e68b69b9807e';
    
    // Check if brand exists
    let brand = await Brand.findOne({
      where: { id: targetBrandId }
    });
    
    if (!brand) {
      console.log('🏗️ Creating brand with ID:', targetBrandId);
      brand = await Brand.create({
        id: targetBrandId,
        businessId: targetBrandId,
        name: 'Default Brand',
        email: `brand-${targetBrandId}@example.com`,
        status: 'active',
        subscriptionPlan: 'basic',
        type: 'SOLO',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ Created brand:', brand.id);
    } else {
      console.log('✅ Found existing brand:', brand.id);
    }
    
    // Check if tenant connection exists
    let tenantConnection = await TenantConnection.findOne({
      where: { brandId: targetBrandId }
    });
    
    if (!tenantConnection) {
      console.log('🏗️ Creating tenant connection...');
      
      // Encrypt the database password
      const algorithm = 'aes-256-cbc';
      const encryptionKey = process.env.CONTROL_PLANE_KMS_KEY || process.env.ENCRYPTION_KEY;
      
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY environment variable is required');
      }
      
      const key = Buffer.from(encryptionKey, 'hex');
      if (key.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
      }
      
      const iv = crypto.createHash('sha256').update(key).digest().slice(0, 16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      
      const password = 'securepass';
      let encryptedPassword = cipher.update(password, 'utf8', 'hex');
      encryptedPassword += cipher.final('hex');
      
      // Create the tenant connection
      tenantConnection = await TenantConnection.create({
        brandId: targetBrandId,
        dbName: 'brewlabs_dev',
        dbHost: 'localhost',
        dbPort: 5432,
        dbUser: 'brewlabs_user',
        encryptedPassword: encryptedPassword,
        databaseUrl: 'postgresql://brewlabs_user:securepass@localhost:5432/brewlabs_dev',
        migrated: true,
        migrationStatus: 'migrated',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('✅ Created tenant connection:', tenantConnection.id);
    } else {
      console.log('✅ Found existing tenant connection:', tenantConnection.id);
    }
    
    console.log('🔗 Database URL:', tenantConnection.databaseUrl);
    
    // Test the connection
    console.log('🧪 Testing tenant connection...');
    const TenantConnectionFactory = require('../src/services/tenantConnectionFactory');
    
    try {
      const sequelize = await TenantConnectionFactory.getConnection(targetBrandId);
      await sequelize.authenticate();
      console.log('✅ Tenant connection test successful');
      
      // Test model injection
      const models = await TenantConnectionFactory.getModels(targetBrandId);
      console.log('✅ Models loaded successfully:', Object.keys(models).length);
      
    } catch (testError) {
      console.error('❌ Tenant connection test failed:', testError.message);
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    console.error(error.stack);
  } finally {
    await controlPlaneSequelize.close();
    process.exit(0);
  }
}

fixBrandConnection();
