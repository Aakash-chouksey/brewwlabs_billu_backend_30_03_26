const { sequelize } = require('../config/unified_database');

async function clearSchemaVersion() {
  try {
    console.log('🧹 Clearing schema_versions for retry...');
    await sequelize.query('DELETE FROM public.schema_versions WHERE version = 1');
    console.log('✅ Version 1 removed from public.schema_versions');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to clear version:', error.message);
    process.exit(1);
  }
}

clearSchemaVersion();
