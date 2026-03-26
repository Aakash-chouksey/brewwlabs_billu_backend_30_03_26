/**
 * TEST SCRIPT: CREATE BROKEN TENANT
 * ================================
 * 1. Creates a new schema 'tenant_broken_test'
 * 2. Adds it to the public.tenant_registry
 * 3. Does NOT create any tables
 */

require('dotenv').config();
const { sequelize } = require('../../config/unified_database');
const { v4: uuidv4 } = require('uuid');
const { PUBLIC_SCHEMA } = require('../../src/utils/constants');

async function createBrokenTenant() {
    const businessId = uuidv4();
    const schemaName = `tenant_${businessId}`;
    
    console.log(`🧪 Creating BROKEN tenant: ${businessId} [${schemaName}]`);
    
    try {
        // 1. Create Schema ONLY
        await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
        console.log(`✅ Schema created: ${schemaName}`);

        // 2. Add to Registry
        const [result] = await sequelize.query(`
            INSERT INTO "${PUBLIC_SCHEMA}"."tenant_registry" (id, business_id, schema_name, status, created_at)
            VALUES (:id, :businessId, :schemaName, 'active', NOW())
        `, {
            replacements: {
                id: uuidv4(),
                businessId: businessId,
                schemaName: schemaName
            }
        });
        
        console.log(`✅ Added to registry. NO TABLES CREATED.`);
        console.log(`🚀 Now run: node maintenance/scripts/repair_all_tenants.js`);

    } catch (error) {
        console.error('🔥 Failed to create broken tenant:', error.message);
    } finally {
        await sequelize.close();
    }
}

createBrokenTenant();
