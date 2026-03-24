#!/usr/bin/env node

/**
 * PARALLEL BACKEND STARTUP SCRIPT
 * 
 * This script ensures proper parallel execution of the backend server
 * with tenant database availability checks and error handling.
 */

const { spawn } = require('child_process');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

console.log('🚀 Starting Multi-Tenant Backend Server (Parallel Mode)');
console.log('===========================================================');

// Environment setup
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.FORCE_COLOR = '1';

// Check if required environment variables are set
const requiredEnvVars = [
    'DATABASE_URL',
    'ENCRYPTION_KEY',
    'JWT_SECRET'
];

const optionalEnvVars = [
    'CONTROL_PLANE_DATABASE_URL'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
const missingOptional = optionalEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
        console.error(`   - ${varName}`);
    });
    console.error('\n💡 Please set these variables in your .env file');
    process.exit(1);
}

if (missingOptional.length > 0) {
    console.warn('⚠️ Missing optional environment variables:');
    missingOptional.forEach(varName => {
        console.warn(`   - ${varName} (will use DATABASE_URL as fallback)`);
    });
    
    // Use DATABASE_URL as fallback for CONTROL_PLANE_DATABASE_URL
    if (!process.env.CONTROL_PLANE_DATABASE_URL && process.env.DATABASE_URL) {
        process.env.CONTROL_PLANE_DATABASE_URL = process.env.DATABASE_URL;
        console.log('🔄 Using DATABASE_URL as CONTROL_PLANE_DATABASE_URL');
    }
}

console.log('✅ Environment variables validated');

// Start the server with nodemon
const serverProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env
});

// Handle process events
serverProcess.on('error', (error) => {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
});

serverProcess.on('close', (code) => {
    if (code !== 0) {
        console.error(`❌ Server exited with code ${code}`);
        process.exit(code);
    } else {
        console.log('✅ Server stopped gracefully');
    }
});

// Handle termination signals
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    serverProcess.kill('SIGTERM');
});

// Health check after startup
setTimeout(async () => {
    try {
        const axios = require('axios');
        const response = await axios.get('http://localhost:8001/health', { timeout: 5000 });
        
        if (response.data.status === 'UP') {
            console.log('✅ Server health check passed');
            console.log(`🌐 Server running at: http://localhost:8001`);
            console.log(`🔍 Health endpoint: http://localhost:8001/health`);
            console.log(`🐛 Debug inspector: chrome://inspect`);
        }
    } catch (error) {
        console.warn('⚠️ Health check failed (server may still be starting):', error.message);
    }
}, 5000);

console.log('📊 Server starting...');
