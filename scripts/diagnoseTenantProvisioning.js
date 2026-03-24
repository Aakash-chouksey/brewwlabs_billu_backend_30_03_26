#!/usr/bin/env node

/**
 * Tenant Provisioning Diagnostic Script
 * 
 * This script helps diagnose why new businesses are going to the main NeonDB
 * instead of being properly separated into individual cafe databases.
 */

const { Brand, TenantConnection } = require('./control_plane_models');
const { decrypt } = require('./src/security/encryption');

async function diagnoseTenantProvisioning() {
    console.log('🔍 Diagnosing Tenant Provisioning Setup...\n');

    // 1. Check environment variables
    console.log('📋 Environment Variables Check:');
    console.log(`DEFAULT_DB_HOST: ${process.env.DEFAULT_DB_HOST || '❌ NOT SET'}`);
    console.log(`DEFAULT_DB_PORT: ${process.env.DEFAULT_DB_PORT || '❌ NOT SET'}`);
    console.log(`DEFAULT_DB_USER: ${process.env.DEFAULT_DB_USER || '❌ NOT SET'}`);
    console.log(`DEFAULT_DB_PASSWORD: ${process.env.DEFAULT_DB_PASSWORD ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`CONTROL_PLANE_DATABASE_URL: ${process.env.CONTROL_PLANE_DATABASE_URL ? '✅ SET' : '❌ NOT SET'}`);
    console.log('');

    // 2. Check existing brands and their connections
    console.log('🏢 Existing Brands and Database Connections:');
    try {
        const brands = await Brand.findAll({
            include: [{
                model: TenantConnection,
                as: 'connections'
            }]
        });

        if (brands.length === 0) {
            console.log('ℹ️ No brands found in control plane database');
        } else {
            for (const brand of brands) {
                console.log(`\n📊 Brand: ${brand.name} (${brand.id})`);
                console.log(`   Status: ${brand.status}`);
                console.log(`   Type: ${brand.type}`);
                
                if (brand.connections && brand.connections.length > 0) {
                    for (const connection of brand.connections) {
                        console.log(`   🔗 Connection:`);
                        console.log(`      Database: ${connection.db_name}`);
                        console.log(`      Host: ${connection.db_host}`);
                        console.log(`      Port: ${connection.db_port}`);
                        console.log(`      User: ${connection.db_user}`);
                        console.log(`      Migrated: ${connection.migrated ? '✅' : '❌'}`);
                        
                        // Test if connection points to main DB
                        if (connection.db_name.includes('postgres') || connection.db_name.includes('neondb')) {
                            console.log(`      ⚠️ WARNING: Using main database instead of separate tenant DB!`);
                        }
                    }
                } else {
                    console.log(`   ❌ No tenant connection found`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error checking brands:', error.message);
    }

    console.log('\n🔧 Recommended Actions:');
    console.log('1. Set the missing environment variables in your .env file:');
    console.log('   DEFAULT_DB_HOST="your-neon-host.neon.tech"');
    console.log('   DEFAULT_DB_PORT=5432');
    console.log('   DEFAULT_DB_USER="your-neon-username"');
    console.log('   DEFAULT_DB_PASSWORD="your-neon-password"');
    console.log('');
    console.log('2. Ensure your Neon database allows creating new databases');
    console.log('3. Test tenant provisioning with a new brand');
    console.log('4. Verify that each brand gets its own database name like "tenant_[brand-id]"');
}

// Run the diagnostic
if (require.main === module) {
    diagnoseTenantProvisioning()
        .then(() => {
            console.log('\n✅ Diagnostic completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Diagnostic failed:', error);
            process.exit(1);
        });
}

module.exports = { diagnoseTenantProvisioning };
