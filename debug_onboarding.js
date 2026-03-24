require('dotenv').config();
const { Client } = require('pg');

console.log('=== DEBUG ONBOARDING CONNECTION ===');
console.log('CONTROL_PLANE_DATABASE_URL:', process.env.CONTROL_PLANE_DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

async function testConnection() {
    try {
        // Test exactly like the onboarding service does
        const cpClient = new Client({ connectionString: process.env.CONTROL_PLANE_DATABASE_URL });
        await cpClient.connect();
        console.log('✅ Connected successfully');
        
        // Test current database
        const dbResult = await cpClient.query('SELECT current_database()');
        console.log('Current database:', dbResult.rows[0].current_database);
        
        // Test if businesses table exists
        const tableResult = await cpClient.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'businesses'
            );
        `);
        console.log('Businesses table exists:', tableResult.rows[0].exists);
        
        // Test counting businesses
        if (tableResult.rows[0].exists) {
            const countResult = await cpClient.query('SELECT COUNT(*) FROM businesses');
            console.log('Businesses count:', countResult.rows[0].count);
        }
        
        await cpClient.end();
        console.log('✅ Connection test completed');
    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testConnection();
