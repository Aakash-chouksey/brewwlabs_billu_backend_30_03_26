#!/usr/bin/env node

/**
 * UPDATE TENANT CONNECTION
 * 
 * Updates the existing tenant connection to include databaseUrl for local development
 */

require('dotenv').config();

async function updateTenantConnection() {
    console.log('🔧 Updating tenant connection...');
    
    try {
        const { controlPlaneSequelize } = require('../config/control_plane_db');
        const { TenantConnection } = require('../control_plane_models');
        
        const brandId = '86bc6bab-4ca3-4e67-af56-d3f4d47b61ae';
        const dbName = `tenant_${brandId.replace(/-/g, '_')}`;
        
        // Update existing tenant connection
        console.log('🔍 Updating existing tenant connection...');
        const [updatedCount] = await TenantConnection.update(
            {
                databaseUrl: `postgresql://postgres:password@localhost:5432/${dbName}`
            },
            {
                where: { brandId }
            }
        );
        
        if (updatedCount > 0) {
            console.log('✅ Tenant connection updated successfully!');
            console.log(`   Brand ID: ${brandId}`);
            console.log(`   DB Name: ${dbName}`);
            console.log(`   Database URL: postgresql://postgres:password@localhost:5432/${dbName}`);
        } else {
            console.log('❌ No tenant connection found to update');
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Failed to update tenant connection:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

if (require.main === module) {
    updateTenantConnection()
        .then(success => {
            console.log('\n🎯 TENANT CONNECTION UPDATE COMPLETE');
            console.log('==================================');
            if (success) {
                console.log('✅ Success! Tenant connection should now work without SSL.');
                console.log('📝 Next steps:');
                console.log('   1. Test orders API');
                console.log('   2. Verify frontend functionality');
            } else {
                console.log('❌ Failed! Check the error messages above.');
            }
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = updateTenantConnection;
