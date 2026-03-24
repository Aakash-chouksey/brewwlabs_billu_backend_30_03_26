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
        console.log('🔄 Syncing SystemMetrics table to public schema...');
        await controlPlaneSequelize.authenticate();
        await SystemMetrics.sync({ force: false });
        console.log('✅ SystemMetrics table synchronized.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Sync failed:', error.message);
        process.exit(1);
    }
}

sync();
