#!/usr/bin/env node

/**
 * CHECK EXISTING TENANTS
 * 
 * Lists all existing tenants in the control plane
 */

require('dotenv').config();

async function checkExistingTenants() {
    console.log('🔍 Checking existing tenants in control plane...');
    
    try {
        const { controlPlaneSequelize } = require('../config/control_plane_db');
        const { Brand, TenantConnection } = require('../control_plane_models');
        
        // Get all brands
        const brands = await Brand.findAll({
            attributes: ['id', 'name', 'status', 'database_url'],
            order: [['created_at', 'ASC']]
        });
        
        console.log(`\n📊 Found ${brands.length} brands:`);
        brands.forEach(brand => {
            console.log(`  - ID: ${brand.id}`);
            console.log(`    Name: ${brand.name}`);
            console.log(`    Status: ${brand.status}`);
            console.log(`    Database URL: ${brand.database_url || 'NOT SET'}`);
            console.log('');
        });
        
        // Get all tenant connections
        const connections = await TenantConnection.findAll({
            attributes: ['id', 'brandId', 'dbHost', 'dbName', 'dbUser'],
            order: [['created_at', 'ASC']]
        });
        
        console.log(`\n🔗 Found ${connections.length} tenant connections:`);
        connections.forEach(conn => {
            console.log(`  - Brand ID: ${conn.brandId}`);
            console.log(`    DB Host: ${conn.dbHost}`);
            console.log(`    DB Name: ${conn.dbName}`);
            console.log(`    DB User: ${conn.dbUser}`);
            console.log('');
        });
        
        return { brands, connections };
        
    } catch (error) {
        console.error('❌ Failed to check existing tenants:', error.message);
        return { brands: [], connections: [] };
    }
}

if (require.main === module) {
    checkExistingTenants()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = checkExistingTenants;
