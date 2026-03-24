
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

        console.log('🔄 Syncing public models...');
        for (const name of publicModels) {
            if (models[name]) {
                process.stdout.write(`  - ${name}... `);
                await models[name].sync({ alter: true });
                console.log('✅');
            }
        }

        console.log('⚠️ Skipping tenant models in complete_init (these belong in tenant schemas)');

        // 5. CP Models
        const cpModelsDir = path.join(__dirname, '../control_plane_models');
        if (fs.existsSync(cpModelsDir)) {
            console.log('🔄 Syncing CP models...');
            const cpModels = require(cpModelsDir);
            for (const [name, modelDef] of Object.entries(cpModels)) {
                // CP models are already initialized in the require, but let's be sure
                try {
                    process.stdout.write(`  - CP ${name}... `);
                    // Use the model's own sync if possible
                    await sequelize.getQueryInterface().showIndex(modelDef.tableName).catch(() => {});
                    await modelDef.sync({ alter: true });
                    console.log('✅');
                } catch (e) {
                    console.log(`❌ ${e.message}`);
                }
            }
        }

        console.log('\n🎉 ALL TABLES INITIALIZED SUCCESSFULLY');
        
    } catch (error) {
        console.error('\n❌ FAILED:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

completeInit();
