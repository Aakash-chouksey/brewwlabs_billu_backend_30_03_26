
require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

async function completeInit() {
    console.log('🚀 Starting Robust Database Initialization...');
    
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('DATABASE_URL not set');
        process.exit(1);
    }

    // Process URL for Neon compatibility
    let processedUrl = databaseUrl;
    processedUrl = processedUrl.replace(/([&?])channel_binding=require(&?)/, (match, prefix, suffix) => {
      return prefix === '?' && suffix ? '?' : prefix === '&' && suffix ? '&' : '';
    });

    console.log(`🔌 Connecting to: ${processedUrl.split('@')[1]}`);

    const sequelize = new Sequelize(processedUrl, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            },
            connectTimeout: 60000 
        },
        pool: {
            max: 1,
            min: 0,
            acquire: 120000,
            idle: 10000
        },
        retry: {
            max: 10,
            timeout: 10000
        }
    });

    try {
        // 1. Authenticate with high timeout
        console.log('📡 Authenticating...');
        await sequelize.authenticate();
        console.log('✅ Connected');

        const models = {};
        const modelsDir = path.join(__dirname, '../models');
        
        // 2. Register models
        console.log('📂 Registering models...');
        fs.readdirSync(modelsDir)
            .filter(file => file.endsWith('.js') && file !== 'associations.js')
            .forEach(file => {
                try {
                    const modelDef = require(path.join(modelsDir, file));
                    if (typeof modelDef === 'function') {
                        const model = modelDef(sequelize);
                        models[model.name] = model;
                    }
                } catch (e) {
                    console.warn(`  ⚠️ Skip model ${file}: ${e.message}`);
                }
            });

        // 3. Define public models that SHOULD stay in public schema
        const publicModels = [
            'Business', 'TenantConnection', 'Subscription', 'SuperAdminUser', 
            'ClusterMetadata', 'TenantMigrationLog', 'Plan', 'AuditLog',
            'User', 'Auth', 'MembershipPlan', 'PartnerType', 'PartnerMembership', 
            'PartnerWallet', 'FeatureFlag', 'WebContent'
        ];

        console.log('⚠️  DEPRECATED: sync() operations removed for Data-First compliance');
        console.log('📋 Use: npm run migrate:control-plane');
        
        // Check which tables exist (verification only)
        const [existingTables] = await sequelize.query(`
            SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
        `);
        const foundTables = existingTables.map(t => t.table_name);
        
        for (const name of publicModels) {
            if (models[name]) {
                const tableName = models[name].tableName || name.toLowerCase() + 's';
                const exists = foundTables.includes(tableName);
                console.log(`  - ${name}: ${exists ? '✅ exists' : '❌ missing (run migrations)'}`);
            }
        }

        console.log('⚠️ Skipping tenant models (belong in tenant schemas)');

        // 5. CP Models - verification only
        const cpModelsDir = path.join(__dirname, '../control_plane_models');
        if (fs.existsSync(cpModelsDir)) {
            console.log('� Checking CP models...');
            const cpModels = require(cpModelsDir);
            for (const [name, modelDef] of Object.entries(cpModels)) {
                try {
                    const tableName = modelDef.tableName;
                    const exists = foundTables.includes(tableName);
                    console.log(`  - CP ${name}: ${exists ? '✅ exists' : '❌ missing'}`);
                } catch (e) {
                    console.log(`  - CP ${name}: ⚠️ ${e.message}`);
                }
            }
        }

        console.log('\n🎉 MIGRATION-BASED INITIALIZATION COMPLETE');
        console.log('⚠️  Note: complete_init.js is DEPRECATED - use migrations instead');
        
    } catch (error) {
        console.error('\n❌ FAILED:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// DEPRECATED: This script no longer runs sync operations
// All schema changes should go through migrations
console.log('⚠️  DEPRECATED: complete_init.js no longer performs sync operations');
console.log('📋 Use migration runner instead: npm run migrate:control-plane');
process.exit(0);

// completeInit(); // DISABLED - Data-First compliance
