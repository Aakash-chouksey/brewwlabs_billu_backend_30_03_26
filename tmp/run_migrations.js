const { controlPlaneSequelize } = require('../config/control_plane_db');
const { runStartupMigrations } = require('../src/architecture/startupMigration');
const { connectUnifiedDB } = require('../config/unified_database');

async function main() {
    try {
        console.log('🚀 Starting manual migration run...');
        await connectUnifiedDB();
        await runStartupMigrations(controlPlaneSequelize);
        console.log('✅ Migrations completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration run failed:', error);
        process.exit(1);
    }
}

main();
