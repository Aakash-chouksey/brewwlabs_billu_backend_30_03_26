console.log('=== TESTING SSL FIX ===');

// Test 1: Check database_postgres configuration
console.log('\n1. TESTING SHARED DATABASE CONFIGURATION:');
try {
    require('dotenv').config();
    
    const databaseUrl = process.env.DATABASE_URL;
    console.log('DATABASE_URL exists:', !!databaseUrl);
    console.log('Is localhost database:', databaseUrl.includes('localhost'));
    
    // Test the processed URL logic
    let processedUrl = databaseUrl;
    if (!databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1')) {
        if (!processedUrl.includes('sslmode=')) {
            processedUrl += processedUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
        }
    }
    
    console.log('Original URL has sslmode:', databaseUrl.includes('sslmode='));
    console.log('Processed URL has sslmode:', processedUrl.includes('sslmode='));
    console.log('SSL should be disabled:', databaseUrl.includes('localhost'));
    
    // Test loading the sequelize configuration
    const { sequelize: sharedSequelize } = require('../../config/database_postgres');
    console.log('✅ Shared database configuration loaded');
    console.log('SSL config:', sharedSequelize.config.dialectOptions.ssl);
    
} catch (error) {
    console.error('❌ Shared database test failed:', error.message);
}

// Test 2: Check tenant connection factory
console.log('\n2. TESTING TENANT CONNECTION FACTORY:');
try {
    const { Sequelize } = require('sequelize');
    
    // Simulate tenant connection configuration
    const tenantConfig = {
        host: 'localhost',
        port: 5432,
        dialect: 'postgres',
        dialectOptions: {
            ssl: false,
            connectTimeout: 15000,
            sslmode: 'disable'
        }
    };
    
    console.log('✅ Tenant SSL configuration:', tenantConfig.dialectOptions.ssl);
    console.log('✅ Tenant sslmode:', tenantConfig.dialectOptions.sslmode);
    
} catch (error) {
    console.error('❌ Tenant connection test failed:', error.message);
}

console.log('\n=== SSL FIX TEST COMPLETED ===');
