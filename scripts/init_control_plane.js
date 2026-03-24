/**
 * 🛠️ CONTROL PLANE INITIALIZATION SCRIPT
 * 
 * Synchronizes only the control plane models to the public schema.
 */

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const { controlPlaneSequelize } = require('../config/control_plane_db');
const { setInitializationPhase } = require('../config/unified_database');

// Import Control Plane Models
const BusinessModel = require('../control_plane_models/businessModel');
const TenantRegistryModel = require('../control_plane_models/tenantRegistryModel');
const AuditLogModel = require('../control_plane_models/auditLogModel').AuditLog; // Note: AuditLog might be a class or factory
const SystemMetricsModel = require('../control_plane_models/systemMetricsModel');
const UserModel = require('../models/userModel'); // User model for public admins

async function initControlPlane() {
    // ENABLE initialization phase - allows DDL queries without transactions
    setInitializationPhase(true);
    
    try {
        console.log('🚀 Initializing Control Plane (Public Schema)...');
        
        // 1. Use centralized control plane models
        const cpModels = require('../control_plane_models');
        const { Business, TenantRegistry, SystemMetrics, AuditLog } = cpModels;
        
        // 2. Also register the User model (tenant/admin)
        const UserModel = require('../models/userModel');
        const User = UserModel(controlPlaneSequelize, DataTypes);

        console.log('📦 Models loaded. Syncing to [public] schema...');

        console.log('📦 Loading schema template for [public] schema...');
        const fs = require('fs');
        const path = require('path');
        const schemaSql = fs.readFileSync(path.join(__dirname, '../db/schema/control_plane_schema.sql'), 'utf8');

        // 3. Execute control plane schema in one pass
        await controlPlaneSequelize.query(schemaSql);

        console.log('\n=== CONTROL PLANE INIT ===');
        console.log('✅ Public schema models synchronized (Static SQL)');
        console.log(`✅ Tables: businesses, users, tenant_registry, system_metrics, audit_logs`);

    } catch (error) {
        console.error('❌ Control Plane Init failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        // DISABLE initialization phase - re-enable transaction enforcement
        setInitializationPhase(false);
        // Close connection
        await controlPlaneSequelize.close();
    }
}

initControlPlane();
