const tenantMigrationService = require('../services/tenantMigrationService');

async function main() {
    console.log('🚀 Starting global tenant migration...');
    try {
        const results = await tenantMigrationService.migrateAllTenants();
        console.log('✅ Global migration complete!');
        console.table(results.details);
        process.exit(0);
    } catch (error) {
        console.error('🚨 Global migration failed:', error.message);
        process.exit(1);
    }
}

main();
