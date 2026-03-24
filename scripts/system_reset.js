const { Sequelize } = require('sequelize');
const { Client } = require('pg');
require('dotenv').config();
const path = require('path');

// Configuration
const dbConfig = {
    host: process.env.DEFAULT_DB_HOST || 'localhost',
    port: process.env.DEFAULT_DB_PORT || 5432,
    user: process.env.DEFAULT_DB_USER || 'brewlabs_user',
    password: process.env.DEFAULT_DB_PASSWORD || 'securepass',
    database: 'brewlabs_dev'
};

const onboardData = {
    businessName: "BrewwLabs POS",
    businessEmail: "abhilashpatel112@gmail.com",
    businessPhone: "1234567890",
    businessAddress: "123 Tech Park, Bangalore",
    gstNumber: "29AAAAA0000A1Z5",
    adminName: "Abhilash Patel",
    adminEmail: "abhilashpatel112@gmail.com",
    adminPassword: "securePassword123",
    cafeType: "SOLO"
};

async function systemReset() {
    console.log('🔄 STARTING COMPREHENSIVE SYSTEM RESET...');

    // 1. Drop All Tables in the Database
    const sequelize = new Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
        host: dbConfig.host,
        port: dbConfig.port,
        dialect: 'postgres',
        logging: console.log
    });

    try {
        await sequelize.authenticate();
        console.log(`🗑️  Dropping all tables in ${dbConfig.database}...`);
        await sequelize.drop({ cascade: true });
        
        // Grant permissions for Postgres 15+ (in case of new schema elements)
        await sequelize.query(`GRANT ALL ON SCHEMA public TO "${dbConfig.user}"`);
        await sequelize.query(`GRANT ALL ON SCHEMA public TO public`);

        console.log('✅ All tables dropped and permissions verified');
    } catch (error) {
        console.error('❌ Table drop failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }

    // 2. Initialize Control Plane Models
    console.log('📋 Initializing Control Plane Models (Static SQL)...');
    try {
        const { controlPlaneSequelize } = require(path.join(process.cwd(), 'config', 'control_plane_db'));
        const fs = require('fs');
        const schemaSql = fs.readFileSync(path.join(process.cwd(), 'db/schema/control_plane_schema.sql'), 'utf8');
        await controlPlaneSequelize.query(schemaSql);
        console.log('✅ Control plane schema synchronized');
    } catch (error) {
        console.error('❌ Control plane initialization failed:', error.message);
        process.exit(1);
    }

    // 3. Perform Fresh Onboarding
    console.log('🏢 Performing fresh onboarding...');
    try {
        const onboardingService = require(path.join(process.cwd(), 'services', 'onboarding.service'));
        const result = await onboardingService.onboardBusiness(onboardData);
        
        console.log('🎉 SYSTEM RESET AND ONBOARDING SUCCESSFUL!');
        console.log('------------------------------------------');
        console.log('Business ID:', result.businessId);
        console.log('Admin Email:', onboardData.adminEmail);
        console.log('Database:', result.databaseName);
        console.log('------------------------------------------');
    } catch (error) {
        console.error('❌ Onboarding failed:', error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }

    process.exit(0);
}

systemReset();
