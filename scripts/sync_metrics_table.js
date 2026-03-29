#!/usr/bin/env node

/**
 * 🛠️ SYSTEM METRICS SYNC
 * 
 * Synchronizes the SystemMetrics table to the public schema.
 */

require('dotenv').config({ override: true });
const { controlPlaneSequelize, SystemMetrics } = require('../control_plane_models');

async function sync() {
    try {
        console.log('🔄 Checking SystemMetrics table via migrations...');
        await controlPlaneSequelize.authenticate();
        
        // Run migrations instead of sync
        const migrationRunner = require('../src/architecture/migrationRunner');
        const SchemaVersion = require('../models/schemaVersionModel')(controlPlaneSequelize);
        const tenantModels = { SchemaVersion: SchemaVersion.schema('public') };
        
        await migrationRunner.runPendingMigrations(controlPlaneSequelize, 'public', tenantModels);
        console.log('✅ SystemMetrics migration complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

sync();
