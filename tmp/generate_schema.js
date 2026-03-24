require('dotenv').config();
const path = require('path');
const rootDir = '/Users/admin/Downloads/billu by brewwlabs/pos-backend-multitenant-issues-resolved-updatd-code-21-march-2026';

const { sequelize } = require(path.join(rootDir, 'config/unified_database'));
const { syncTenantModels } = require(path.join(rootDir, 'src/architecture/modelLoader'));

async function generate() {
    const schemaName = 'tenant_template';
    try {
        console.log(`🚀 Creating template schema [${schemaName}]...`);
        await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
        
        await sequelize.transaction(async (transaction) => {
            await syncTenantModels(sequelize, schemaName, transaction);
        });
        
        console.log(`✅ Template schema [${schemaName}] synchronized successfully.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Generation failed:', error.message);
        process.exit(1);
    }
}

generate();
