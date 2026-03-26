const { sequelize } = require('../config/unified_database');
const { ModelFactory } = require('../src/architecture/modelFactory');

async function dryRun() {
    console.log('🚀 DRY RUN: Model Registry Audit');
    
    // 1. Initialize all models
    await ModelFactory.createModels(sequelize);
    
    // 2. Extract model names
    const modelNames = Object.keys(sequelize.models);
    console.log(`Total models in registry: ${modelNames.length}`);
    
    // 3. Check for AuditLog specifically
    const auditLogModel = sequelize.models.AuditLog;
    if (auditLogModel) {
        console.log('AuditLog model found.');
        console.log('Defined attributes:', Object.keys(auditLogModel.rawAttributes).length);
        // Check if it's the tenant one or platform one
        if (auditLogModel.rawAttributes.severityLevel) {
            console.log('✅ AuditLog identified as PLATFORM (Control Plane)');
        } else {
            console.log('⚠️ AuditLog identified as TENANT (Wait, this might be a collision)');
        }
    }
    
    process.exit(0);
}

dryRun().catch(err => {
    console.error(err);
    process.exit(1);
});
