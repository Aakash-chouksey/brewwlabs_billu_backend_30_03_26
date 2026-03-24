require('dotenv').config();
const { controlPlaneSequelize } = require('../config/control_plane_db.js');
const { TenantConnection, Brand } = require('../control_plane_models');
const crypto = require('crypto');

async function setupTenantConnection() {
  try {
    console.log('🔧 Setting up tenant connection for brand: 7ac6261d-fca7-4277-a264-e68b69b9807e');
    
    // Check existing brands
    const brands = await Brand.findAll();
    console.log('📋 Found brands:', brands.length);
    
    const targetBrandId = '7ac6261d-fca7-4277-a264-e68b69b9807e';
    let targetBrand = brands.find(brand => brand.id === targetBrandId);
    
    if (!targetBrand) {
      // Check if this brandId is actually a businessId
      targetBrand = brands.find(brand => brand.businessId === targetBrandId);
      
      if (!targetBrand) {
        console.log('❌ No brand found with ID or businessId:', targetBrandId);
        console.log('Available brands:');
        brands.forEach(brand => {
          console.log(`  - ID: ${brand.id}, BusinessId: ${brand.businessId}, Name: ${brand.name || 'No name'}`);
        });
        
        // Create a new brand if none exists
        console.log('🏗️ Creating new brand...');
        targetBrand = await Brand.create({
          id: targetBrandId,
          businessId: targetBrandId,
          name: 'Default Brand',
          status: 'active',
          subscriptionId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log('✅ Created new brand:', targetBrand.id);
      } else {
        console.log('✅ Found brand by businessId:', targetBrand.id);
      }
    } else {
      console.log('✅ Found brand by ID:', targetBrand.id);
    }
    
    // Check existing tenant connections
    const existingConnections = await TenantConnection.findAll({
      where: { brandId: targetBrand.id }
    });
    
    if (existingConnections.length > 0) {
      console.log('📋 Existing tenant connections found:', existingConnections.length);
      existingConnections.forEach(conn => {
        console.log(`  - ${conn.id}: ${conn.dbHost}:${conn.dbPort}/${conn.dbName}`);
      });
      console.log('✅ Tenant connection already exists');
      return;
    }
    
    // Create tenant connection for local database
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
    const tenantConnection = await TenantConnection.create({
      brandId: targetBrand.id,
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
    console.log('🔗 Database URL:', tenantConnection.databaseUrl);
    
    // Verify the connection
    console.log('🧪 Testing tenant connection...');
    const TenantConnectionFactory = require('../src/services/tenantConnectionFactory');
    
    try {
      const sequelize = await TenantConnectionFactory.getConnection(targetBrand.id);
      await sequelize.authenticate();
      console.log('✅ Tenant connection test successful');
    } catch (testError) {
      console.error('❌ Tenant connection test failed:', testError.message);
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error(error.stack);
  } finally {
    await controlPlaneSequelize.close();
    process.exit(0);
  }
}

setupTenantConnection();
