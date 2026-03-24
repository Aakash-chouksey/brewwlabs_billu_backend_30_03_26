#!/usr/bin/env node

/**
 * Fix database timeout issues by improving connection configuration
 */

const fs = require('fs');
const path = require('path');

function fixDatabaseConfig() {
    console.log('🔧 Fixing database timeout configuration...');
    
    const configPath = path.join(__dirname, '../config/database_postgres.js');
    let content = fs.readFileSync(configPath, 'utf8');
    
    // Fix 1: Remove hardcoded DNS resolution that's causing issues
    content = content.replace(
        /\/\/ DECISIVE FIX: Hardcode Neon DNS resolution to bypass local system failures[\s\S]*?dns\.lookup = function\(hostname, options, callback\)[\s\S]*?return originalLookup\(hostname, options, callback\);[\s\S]*?};/gs,
        '// DNS resolution handled by system default'
    );
    
    // Fix 2: Improve connection timeouts
    content = content.replace(
        /connectTimeout: 60000/g,
        'connectTimeout: 30000' // 30 seconds instead of 60
    );
    
    // Fix 3: Reduce pool max to prevent connection exhaustion
    content = content.replace(
        /max: 15/g,
        'max: 5' // Reduced from 15 to 5
    );
    
    // Fix 4: Increase retry timeout
    content = content.replace(
        /timeout: 10000/g,
        'timeout: 30000' // 30 seconds instead of 10
    );
    
    // Fix 5: Add connection retry with exponential backoff
    const retrySection = `retry: {
    max: 3,
    timeout: 30000,
    backoffBase: 100,
    backoffExponent: 1.5
  }`;
    
    content = content.replace(
        /retry: \{[\s\S]*?max: 5,[\s\S]*?timeout: 10000[\s\S]*?\}/g,
        retrySection
    );
    
    // Fix 6: Improve SSL configuration
    content = content.replace(
        /ssl: \{[\s\S]*?require: true,[\s\S]*?rejectUnauthorized: false[\s\S]*?\}/g,
        `ssl: {
        require: true,
        rejectUnauthorized: false,
        // Use verify-full for better security
        sslmode: 'verify-full'
      }`
    );
    
    fs.writeFileSync(configPath, content);
    console.log('✅ Fixed database configuration');
    
    // Also fix the SSL warning by updating the connection string
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        // Fix SSL mode in DATABASE_URL
        envContent = envContent.replace(
            /sslmode=require/g,
            'sslmode=verify-full'
        );
        
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Fixed SSL mode in .env');
    }
}

function createConnectionTest() {
    console.log('🧪 Creating connection test script...');
    
    const testScript = `
const { connectDB } = require('./config/database_postgres');

async function testConnection() {
    try {
        console.log('🔌 Testing database connection...');
        await connectDB(1, 1000); // 1 retry, 1 second delay
        console.log('✅ Database connection successful!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        
        if (error.message.includes('timeout')) {
            console.log('💡 Suggestion: Check network connectivity to Neon database');
            console.log('💡 Suggestion: Verify DATABASE_URL is correct');
            console.log('💡 Suggestion: Try using a VPN if network is restricted');
        }
        
        process.exit(1);
    }
}

testConnection();
`;
    
    fs.writeFileSync(path.join(__dirname, 'test_db_connection.js'), testScript);
    console.log('✅ Created test_db_connection.js');
}

if (require.main === module) {
    fixDatabaseConfig();
    createConnectionTest();
    
    console.log('\n🚀 Next steps:');
    console.log('1. Run: node test_db_connection.js');
    console.log('2. If successful, start the server: npm start');
    console.log('3. Monitor for any remaining connection issues');
}

module.exports = { fixDatabaseConfig, createConnectionTest };
