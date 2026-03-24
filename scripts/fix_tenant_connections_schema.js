#!/usr/bin/env node

/**
 * FIX TENANT CONNECTIONS SCHEMA
 * 
 * Adds the missing database_url column to tenant_connections table
 */

require('dotenv').config();

async function fixTenantConnectionsSchema() {
    console.log('🔧 Fixing tenant_connections schema...');
    
    try {
        const { controlPlaneSequelize } = require('../config/control_plane_db');
        
        // Check if database_url column exists
        const tableInfo = await controlPlaneSequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'tenant_connections' 
            AND column_name = 'database_url'
        `, {
            type: controlPlaneSequelize.QueryTypes.SELECT
        });
        
        if (tableInfo.length === 0) {
            console.log('❌ database_url column missing - adding it...');
            
            // Add the column
            await controlPlaneSequelize.query(`
                ALTER TABLE tenant_connections 
                ADD COLUMN database_url TEXT
            `);
            
            console.log('✅ database_url column added');
            
            // Create index
            await controlPlaneSequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_tenant_connections_database_url 
                ON tenant_connections(database_url)
            `);
            
            console.log('✅ database_url index created');
            
        } else {
            console.log('✅ database_url column already exists');
        }
        
        // Check existing data
        const connections = await controlPlaneSequelize.query(`
            SELECT id, brand_id, db_host, db_name, db_user, database_url
            FROM tenant_connections 
            LIMIT 5
        `, {
            type: controlPlaneSequelize.QueryTypes.SELECT
        });
        
        console.log(`📊 Found ${connections.length} tenant connections:`);
        connections.forEach(conn => {
            console.log(`  - Brand ${conn.brand_id}: ${conn.db_host}/${conn.db_name} (has database_url: ${!!conn.database_url})`);
        });
        
        console.log('✅ Tenant connections schema fixed successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Failed to fix tenant connections schema:', error.message);
        return false;
    }
}

if (require.main === module) {
    fixTenantConnectionsSchema()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = fixTenantConnectionsSchema;
