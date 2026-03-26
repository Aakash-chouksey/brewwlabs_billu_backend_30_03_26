const { sequelize } = require('../config/unified_database');
const { ModelFactory } = require('../src/architecture/modelFactory');
const { CONTROL_MODELS, TENANT_MODELS } = require('../src/utils/constants');

async function audit() {
    console.log('🔍 ARCHITECTURE INTEGRITY AUDIT');
    console.log('-------------------------------');
    
    let failures = 0;

    // 1. Initialize Registry
    await ModelFactory.createModels(sequelize);
    const registeredModels = Object.keys(sequelize.models);
    console.log('Registered in Sequelize:', registeredModels);
    
    console.log(`\nSTEP 1: Model Classification Audit`);
    for (const modelName of registeredModels) {
        const isControl = CONTROL_MODELS.includes(modelName);
        const isTenant = TENANT_MODELS.includes(modelName);
        
        if (!isControl && !isTenant) {
            console.error(`❌ FAIL: Model "${modelName}" is REGISTERED but NOT CLASSIFIED in constants.js`);
            failures++;
        }
        if (isControl && isTenant) {
            console.error(`❌ FAIL: Model "${modelName}" is in BOTH CONTROL and TENANT lists`);
            failures++;
        }
    }
    
    for (const modelName of CONTROL_MODELS) {
        if (!registeredModels.includes(modelName) && modelName !== 'Auth') {
            console.error(`❌ FAIL: Control model "${modelName}" is defined in constants but NOT REGISTERED`);
            failures++;
        }
    }

    // 2. Schema Validation (Physical)
    console.log(`\nSTEP 2: Schema Isolation Audit`);
    const sampleSchema = 'tenant_2e05afc6-6e3f-4d9e-8204-bd1c01adadcf';
    
    // Check Public Schema
    const [publicTables] = await sequelize.query(`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const publicTableNames = publicTables.map(t => t.table_name);
    
    // Check Tenant Schema
    const [tenantTables] = await sequelize.query(`
        SELECT table_name FROM information_schema.tables WHERE table_schema = :schema AND table_type = 'BASE TABLE'
    `, { replacements: { schema: sampleSchema } });
    const tenantTableNames = tenantTables.map(t => t.table_name);

    // Rule: Control models should NOT be in Tenant schema
    for (const modelName of CONTROL_MODELS) {
        const model = sequelize.models[modelName];
        if (!model) continue;
        const tableName = model.getTableName();
        const simpleTable = typeof tableName === 'string' ? tableName : tableName.tableName;
        
        if (tenantTableNames.includes(simpleTable)) {
            console.error(`❌ FAIL: Control table "${simpleTable}" (Model: ${modelName}) FOUND in tenant schema "${sampleSchema}"`);
            failures++;
        } else {
            // console.log(`✅ OK: Control model ${modelName} correctly isolated from tenant`);
        }
    }

    // Rule: Tenant models should NOT be in Public schema
    for (const modelName of TENANT_MODELS) {
        const model = sequelize.models[modelName];
        if (!model) continue;
        const tableName = model.getTableName();
        const simpleTable = typeof tableName === 'string' ? tableName : tableName.tableName;
        
        if (publicTableNames.includes(simpleTable)) {
            // Some might overlap by design if shared, but usually not in this architecture
            console.error(`❌ FAIL: Tenant table "${simpleTable}" (Model: ${modelName}) FOUND in public schema`);
            failures++;
        }
    }

    console.log('\n-------------------------------');
    if (failures === 0) {
        console.log('✨ AUDIT PASSED: System is architecturally consistent.');
    } else {
        console.error(`🚨 AUDIT FAILED with ${failures} architectural violations!`);
    }
    
    process.exit(failures > 0 ? 1 : 0);
}

audit().catch(err => {
    console.error(err);
    process.exit(1);
});
