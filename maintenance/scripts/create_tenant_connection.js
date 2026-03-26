#!/usr/bin/env node

require('dotenv').config();
const { Sequelize } = require('sequelize');
const { encryptPassword } = require('../../src/security/encryption');
const { v4: uuidv4 } = require('uuid');

async function createTenantConnectionForBrand(brandId) {
    console.log(`🔧 Creating tenant connection for brand: ${brandId}`);
    
    const controlPlaneSequelize = new Sequelize(process.env.CONTROL_PLANE_DATABASE_URL, {
        logging: false
    });

    try {
        // Check if brand exists
        console.log('🔍 Checking brand exists...');
        const brands = await controlPlaneSequelize.query(
            'SELECT * FROM brands WHERE id = :brandId',
            {
                replacements: { brandId },
                type: Sequelize.QueryTypes.SELECT
            }
        );
        
        if (brands.length === 0) {
            console.error('❌ Brand not found:', brandId);
            return false;
        }
        
        console.log('✅ Brand found:', brands[0].name);
        
        // Check if tenant connection already exists
        console.log('🔍 Checking existing tenant connection...');
        const existingConnections = await controlPlaneSequelize.query(
            'SELECT * FROM tenant_connections WHERE brand_id = :brandId',
            {
                replacements: { brandId },
                type: Sequelize.QueryTypes.SELECT
            }
        );
        
        if (existingConnections.length > 0) {
            console.log('⚠️ Tenant connection already exists');
            console.log('Connection details:', existingConnections[0]);
            return true;
        }
        
        // Create tenant connection
        console.log('🔧 Creating new tenant connection...');
        const tenantDbName = `tenant_${brandId.replace(/-/g, '_')}`;
        const encryptedPassword = encryptPassword('securepass');
        
        await controlPlaneSequelize.query(`
            INSERT INTO tenant_connections (
                id, brand_id, db_host, db_port, db_name, db_user, 
                encrypted_password, status, created_at, updated_at
            ) VALUES (
                :id, :brandId, :dbHost, :dbPort, :dbName, :dbUser,
                :encryptedPassword, :status, NOW(), NOW()
            )
        `, {
            replacements: {
                id: uuidv4(),
                brandId: brandId,
                dbHost: 'localhost',
                dbPort: 5432,
                dbName: tenantDbName,
                dbUser: 'brewlabs_user',
                encryptedPassword: encryptedPassword,
                status: 'ACTIVE'
            }
        });
        
        console.log('✅ Tenant connection created successfully');
        console.log(`📊 Database name: ${tenantDbName}`);
        console.log(`🔗 Host: localhost`);
        console.log(`👤 User: brewlabs_user`);
        
        await controlPlaneSequelize.close();
        return true;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        await controlPlaneSequelize.close();
        return false;
    }
}

// Get brand ID from command line arguments
const brandId = process.argv[2];
if (!brandId) {
    console.error('❌ Please provide a brand ID');
    console.log('Usage: node create_tenant_connection.js <brand-id>');
    process.exit(1);
}

createTenantConnectionForBrand(brandId).then(success => {
    process.exit(success ? 0 : 1);
});
