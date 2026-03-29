const { runStartupMigrations } = require('../../src/architecture/startupMigration');

async function trigger() {
    console.log('🛠️  Triggering System-Wide Repairs...');
    await runStartupMigrations();
    console.log('✅ Repairs finished.');
    process.exit(0);
}

trigger().catch(err => {
    console.error('❌ Repair trigger failed:', err);
    process.exit(1);
});
