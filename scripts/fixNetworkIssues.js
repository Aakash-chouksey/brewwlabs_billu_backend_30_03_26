#!/usr/bin/env node

/**
 * Fix network connectivity issues for Neon database
 */

const fs = require('fs');
const path = require('path');
const dns = require('dns');

function fixNetworkConfiguration() {
    console.log('🔧 Fixing network configuration...');
    
    // Test DNS resolution
    const neonHost = 'ep-lively-glitter-a1yqd90q-pooler.ap-southeast-1.aws.neon.tech';
    
    console.log('🔍 Testing DNS resolution...');
    dns.lookup(neonHost, { family: 4 }, (err, address, family) => {
        if (err) {
            console.log('❌ DNS resolution failed:', err.message);
            console.log('🔄 Trying alternative approach...');
            
            // Try to resolve with different method
            dns.resolve4(neonHost, (err, addresses) => {
                if (err) {
                    console.log('❌ Alternative DNS failed:', err.message);
                    console.log('💡 Using hardcoded IP as fallback...');
                    createFallbackConfig('13.228.184.177'); // Neon's IP
                } else {
                    console.log('✅ Alternative DNS resolved:', addresses[0]);
                    createFallbackConfig(addresses[0]);
                }
            });
        } else {
            console.log('✅ DNS resolved:', address);
            createFallbackConfig(address);
        }
    });
}

function createFallbackConfig(ipAddress) {
    console.log('🔧 Creating network fallback configuration...');
    
    const configPath = path.join(__dirname, '../config/database_postgres.js');
    let content = fs.readFileSync(configPath, 'utf8');
    
    // Create improved DNS resolution with fallback
    const dnsFix = `
// Network fallback configuration for Neon database
const dns = require('dns');
const originalLookup = dns.lookup;

const NEON_HOST = '${ipAddress}';
const NEON_DOMAIN = 'ep-lively-glitter-a1yqd90q-pooler.ap-southeast-1.aws.neon.tech';

dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  // Use IP for Neon host to avoid DNS issues
  if (hostname === NEON_DOMAIN) {
    const isAll = options && options.all;
    if (isAll) {
      return callback(null, [{ address: NEON_HOST, family: 4 }]);
    }
    return callback(null, NEON_HOST, 4);
  }
  
  return originalLookup(hostname, options, callback);
};`;

    // Replace existing DNS fix if present
    content = content.replace(
        /\/\/ DNS resolution handled by system default/g,
        dnsFix.trim()
    );
    
    // Update connection timeouts for better reliability
    content = content.replace(
        /connectTimeout: 30000/g,
        'connectTimeout: 45000' // 45 seconds
    );
    
    content = content.replace(
        /acquire: 180000/g,
        'acquire: 300000' // 5 minutes to acquire connection
    );
    
    // Add retry with exponential backoff
    content = content.replace(
        /retry: \{[\s\S]*?max: 3,[\s\S]*?timeout: 30000,[\s\S]*?backoffBase: 100,[\s\S]*?backoffExponent: 1\.5[\s\S]*?\}/g,
        `retry: {
    max: 5,
    timeout: 45000,
    backoffBase: 1000,
    backoffExponent: 2,
    randomize: true
  }`
    );
    
    // Add connection health check
    const healthCheck = `
// Connection health check
sequelize.addHook('beforeConnect', () => {
  console.log('🔌 Connecting to database...');
});

sequelize.addHook('afterConnect', () => {
  console.log('✅ Database connection established');
});

sequelize.addHook('beforeDisconnect', () => {
  console.log('🔌 Disconnecting from database...');
});`;

    // Add health check hooks before the connectDB function
    content = content.replace(
        /const connectDB = async/g,
        healthCheck.trim() + '\n\nconst connectDB = async'
    );
    
    fs.writeFileSync(configPath, content);
    console.log('✅ Updated network configuration with fallback');
    
    // Create simple connectivity test
    createConnectivityTest(ipAddress);
}

function createConnectivityTest(ipAddress) {
    console.log('🧪 Creating connectivity test...');
    
    const testScript = `
const net = require('net');

async function testConnectivity() {
    const host = '${ipAddress}';
    const port = 5432; // PostgreSQL port
    
    return new Promise((resolve) => {
        const socket = new net.Socket();
        
        socket.setTimeout(10000); // 10 second timeout
        
        socket.on('connect', () => {
            console.log('✅ Network connectivity to Neon database confirmed');
            socket.destroy();
            resolve(true);
        });
        
        socket.on('timeout', () => {
            console.log('❌ Network timeout - connection to Neon failed');
            socket.destroy();
            resolve(false);
        });
        
        socket.on('error', (err) => {
            console.log('❌ Network error:', err.message);
            resolve(false);
        });
        
        socket.connect(port, host);
    });
}

async function runTest() {
    console.log('🔍 Testing network connectivity to Neon database...');
    const connected = await testConnectivity();
    
    if (connected) {
        console.log('🎉 Network is ready for database connection');
        console.log('💡 Now run: npm start');
    } else {
        console.log('🚨 Network issues detected');
        console.log('💡 Suggestions:');
        console.log('   1. Check internet connection');
        console.log('   2. Try using a VPN');
        console.log('   3. Check firewall settings');
        console.log('   4. Verify DNS is working');
    }
    
    process.exit(connected ? 0 : 1);
}

runTest();
`;
    
    fs.writeFileSync(path.join(__dirname, 'test_network_connectivity.js'), testScript);
    console.log('✅ Created network connectivity test');
}

if (require.main === module) {
    fixNetworkConfiguration();
}

module.exports = { fixNetworkConfiguration, createFallbackConfig };
