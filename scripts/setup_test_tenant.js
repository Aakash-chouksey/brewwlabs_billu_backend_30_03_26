#!/usr/bin/env node

/**
 * SETUP TEST TENANT
 * 
 * Adds database_url field to brands table and creates a test tenant
 */

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');

async function setupTestTenant() {
    console.log('🔧 Setting up test tenant...');
    
    try {
        const { controlPlaneSequelize } = require('../config/control_plane_db');
        const { Brand, TenantConnection } = require('../control_plane_models');
        const crypto = require('crypto');
        
        // Add database_url field to brands table if it doesn't exist
        console.log('🔍 Checking brands table schema...');
        const brandColumns = await controlPlaneSequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'brands' 
            AND column_name = 'database_url'
        `, {
            type: controlPlaneSequelize.QueryTypes.SELECT
        });
        
        if (brandColumns.length === 0) {
            console.log('➕ Adding database_url field to brands table...');
            await controlPlaneSequelize.query(`
                ALTER TABLE brands 
                ADD COLUMN database_url TEXT
            `);
            console.log('✅ database_url field added to brands table');
        } else {
            console.log('✅ database_url field already exists in brands table');
        }
        
        // Check if test brand exists
        console.log('🔍 Checking for existing test brand...');
        let testBrand = await Brand.findOne({
            where: { email: 'test@brewcafe.com' }
        });
        
        if (!testBrand) {
            console.log('➕ Creating test brand...');
            const brandId = uuidv4();
            
            testBrand = await Brand.create({
                id: brandId,
                name: 'Test Cafe',
                email: 'test@brewcafe.com',
                phone: '+1234567890',
                address: '123 Test Street',
                status: 'active',
                subscriptionPlan: 'basic',
                type: 'SOLO',
                database_url: process.env.DEFAULT_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/test_tenant'
            });
            
            console.log(`✅ Created test brand with ID: ${brandId}`);
        } else {
            console.log(`✅ Test brand already exists with ID: ${testBrand.id}`);
        }
        
        // Check if tenant connection exists
        console.log('🔍 Checking for existing tenant connection...');
        let tenantConn = await TenantConnection.findOne({
            where: { brandId: testBrand.id }
        });
        
        if (!tenantConn) {
            console.log('➕ Creating tenant connection...');
            
            // Encrypt a test password
            const algorithm = 'aes-256-cbc';
            const encryptionKey = process.env.ENCRYPTION_KEY || 'default32characterkey!';
            const key = Buffer.from(encryptionKey, 'hex');
            const iv = crypto.createHash('sha256').update(key).digest().slice(0, 16);
            
            const testPassword = 'test123';
            const cipher = crypto.createCipheriv(algorithm, key, iv);
            let encrypted = cipher.update(testPassword, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            tenantConn = await TenantConnection.create({
                brandId: testBrand.id,
                dbName: 'test_tenant',
                dbHost: 'localhost',
                dbPort: 5432,
                dbUser: 'postgres',
                encryptedPassword: encrypted,
                migrated: true,
                migrationStatus: 'migrated',
                databaseUrl: process.env.DEFAULT_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/test_tenant'
            });
            
            console.log(`✅ Created tenant connection for brand: ${testBrand.id}`);
        } else {
            console.log(`✅ Tenant connection already exists for brand: ${tenantConn.brandId}`);
        }
        
        console.log('\n🎯 TEST TENANT SETUP COMPLETE');
        console.log('===============================');
        console.log(`Brand ID: ${testBrand.id}`);
        console.log(`Brand Email: ${testBrand.email}`);
        console.log(`Tenant Connection: ${tenantConn ? 'EXISTS' : 'MISSING'}`);
        
        if (tenantConn) {
            console.log(`DB Host: ${tenantConn.dbHost}`);
            console.log(`DB Name: ${tenantConn.dbName}`);
            console.log(`DB User: ${tenantConn.dbUser}`);
        }
        
        return {
            brandId: testBrand.id,
            brandEmail: testBrand.email,
            tenantConnection: !!tenantConn
        };
        
    } catch (error) {
        console.error('❌ Failed to setup test tenant:', error.message);
        return null;
    }
}

if (require.main === module) {
    setupTestTenant()
        .then(result => {
            if (result) {
                console.log('\n✅ Success! You can now test APIs with:');
                console.log(`  - Brand ID: ${result.brandId}`);
                console.log(`  - Email: test@brewcafe.com`);
                console.log(`  - Password: test123`);
            }
            process.exit(result ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = setupTestTenant;
