require('dotenv').config();
const { Client } = require('pg');

async function testTenantConnection() {
    try {
        // Test the exact parameters that would be used for a tenant
        const sequelize = require('sequelize');
        const tenantConnection = {
            dbName: 'tenant_test_db',
            dbHost: 'localhost',
            dbPort: 5432,
            dbUser: 'postgres',
            encryptedPassword: 'password'
        };
        
        console.log('🔍 Testing tenant connection with:', {
            database: tenantConnection.dbName,
            username: tenantConnection.dbUser,
            host: tenantConnection.dbHost,
            port: tenantConnection.dbPort,
            NODE_ENV: process.env.NODE_ENV
        });
        
        // Test raw PostgreSQL connection first
        const client = new Client({
            host: tenantConnection.dbHost,
            port: tenantConnection.dbPort,
            user: tenantConnection.dbUser,
            password: 'password',
            database: 'postgres' // Connect to default database first
        });
        
        await client.connect();
        console.log('✅ Raw PostgreSQL connection successful');
        
        // Test if tenant database exists
        const dbCheck = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [tenantConnection.dbName]);
        if (dbCheck.rows.length === 0) {
            console.log('📝 Creating tenant database...');
            await client.query(`CREATE DATABASE "${tenantConnection.dbName}"`);
            console.log('✅ Tenant database created');
        } else {
            console.log('✅ Tenant database already exists');
        }
        
        await client.end();
        
        // Now test Sequelize connection
        console.log('🔧 Testing Sequelize connection...');
        const seq = new sequelize.Sequelize(
            tenantConnection.dbName,
            tenantConnection.dbUser,
            'password',
            {
                host: tenantConnection.dbHost,
                port: tenantConnection.dbPort,
                dialect: 'postgres',
                logging: console.log,
                define: { underscored: true },
                dialectOptions: {
                    ssl: process.env.NODE_ENV === 'production' ? {
                        require: true,
                        rejectUnauthorized: false
                    } : false,
                    connectTimeout: 15000
                }
            }
        );
        
        await seq.authenticate();
        console.log('✅ Sequelize tenant connection successful');
        await seq.close();
        
    } catch (error) {
        console.error('❌ Tenant connection test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testTenantConnection();
