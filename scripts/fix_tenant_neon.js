require('dotenv').config();
const { controlPlaneSequelize } = require('../config/control_plane_db');
const { TenantConnection } = require('../control_plane_models');

async function fixTenantConnection() {
    try {
        await controlPlaneSequelize.authenticate();
        console.log('✅ Control plane connected');
        
        const conn = await TenantConnection.findOne({
            where: { brand_id: '86bc6bab-4ca3-4e67-af56-d3f4d47b61ae' }
        });
        
        if (conn) {
            console.log('Current tenant connection:');
            console.log('- Database URL:', conn.databaseUrl);
            console.log('- DB Host:', conn.dbHost);
            
            // Update to use Neon database instead of localhost
            const neonDatabaseUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_ftcY7qM5vGUe@ep-lively-glitter-a1yqd90q-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require";
            
            // Update tenant connection to use Neon
            await TenantConnection.update({
                databaseUrl: neonDatabaseUrl,
                dbHost: 'ep-lively-glitter-a1yqd90q-pooler.ap-southeast-1.aws.neon.tech',
                dbPort: 5432,
                dbName: 'neondb',
                dbUser: 'neondb_owner',
                migrated: true
            }, {
                where: { brand_id: '86bc6bab-4ca3-4e67-af56-d3f4d47b61ae' }
            });
            
            console.log('✅ Updated tenant connection to use Neon database');
        } else {
            console.log('❌ No tenant connection found');
        }
        
        await controlPlaneSequelize.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

fixTenantConnection();
