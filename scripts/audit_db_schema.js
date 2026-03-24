/**
 * DATABASE SCHEMA AUDIT TOOL - COMPREHENSIVE VERSION
 * Scans Sequelize models and compares them against actual database schema.
 * Generates idempotent migrations for missing columns, keys, and indexes.
 */

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const { controlPlaneSequelize, Brand, TenantConnection } = require('../control_plane_models');
const { initializeTenantModels } = require('../src/db/tenantModelRegistry');
const { getTenantSequelize } = require('../src/db/tenantConnectionFactory');
const fs = require('fs');
const path = require('path');

// Type mapping for SQL generation
const DB_TYPE_MAP = {
    'UUID': 'UUID',
    'STRING': 'VARCHAR(255)',
    'TEXT': 'TEXT',
    'INTEGER': 'INTEGER',
    'DECIMAL': 'DECIMAL(10, 2)',
    'BOOLEAN': 'BOOLEAN',
    'DATE': 'TIMESTAMP WITH TIME ZONE',
    'JSON': 'JSONB',
    'ENUM': 'VARCHAR(255)'
};

// Required Tenant Schema Requirements
const REQUIRED_TENANT_SCHEMA = {
    users: ['id', 'business_id', 'name', 'email', 'password_hash', 'role', 'is_active', 'primary_outlet_id'],
    user_outlets: ['id', 'user_id', 'outlet_id', 'is_active'],
    outlets: ['id', 'business_id', 'name', 'is_active'],
    categories: ['id', 'business_id', 'outlet_id', 'name', 'is_enabled', 'sort_order'],
    product_types: ['id', 'business_id', 'outlet_id', 'name'],
    products: ['id', 'business_id', 'category_id', 'product_type_id', 'outlet_id', 'name', 'price', 'is_available'],
    inventory: ['id', 'business_id', 'product_id', 'outlet_id', 'quantity', 'min_stock', 'max_stock', 'last_updated'],
    table_areas: ['id', 'business_id', 'outlet_id', 'name'],
    tables: ['id', 'business_id', 'area_id', 'outlet_id', 'name', 'capacity', 'status'],
    orders: ['id', 'business_id', 'order_number', 'waiter_id', 'total_amount', 'outlet_id', 'status'],
    order_items: ['id', 'order_id', 'product_id', 'quantity', 'unit_price', 'total_price']
};

async function auditDatabase() {
    console.log('🚀 Starting Full Database System Audit...');
    
    const report = {
        controlPlane: {
            tablesDetected: [],
            missingTables: [],
            missingColumns: [],
            migrations: []
        },
        tenants: []
    };

    try {
        // 1. Audit Control Plane
        console.log('\n--- Auditing Control Plane ---');
        await auditTarget(controlPlaneSequelize, 'control_plane', report.controlPlane);

        // 2. Audit Tenants
        const brandIdFilter = process.argv[2];
        const where = brandIdFilter ? { brand_id: brandIdFilter } : {};
        const connections = await TenantConnection.findAll({ where });
        console.log(`\n--- Found ${connections.length} Tenant(s) ---`);

        for (const conn of connections) {
            try {
                console.log(`\nChecking Tenant: ${conn.db_name} (Brand: ${conn.brand_id})`);
                const tenantSequelize = await getTenantSequelize(conn);
                const tenantReport = {
                    brandId: conn.brand_id,
                    dbName: conn.db_name,
                    tablesDetected: [],
                    missingTables: [],
                    missingColumns: [],
                    migrations: []
                };
                
                await auditTarget(tenantSequelize, 'tenant', tenantReport);
                report.tenants.push(tenantReport);
                
                await tenantSequelize.close();
            } catch (err) {
                console.error(`  ❌ Failed to audit tenant ${conn.db_name}: ${err.message}`);
                report.tenants.push({
                    brandId: conn.brand_id,
                    dbName: conn.db_name,
                    error: err.message
                });
            }
        }

        // 3. Save Output
        fs.writeFileSync('audit_report.json', JSON.stringify(report, null, 2));
        generateMigrationFile(report);
        console.log(`\n✅ Audit Complete. Report: audit_report.json, SQL: scripts/generated_schema_fixes.sql`);

    } catch (error) {
        console.error('❌ Audit Failed:', error);
        process.exit(1);
    }
}

async function auditTarget(sequelize, type, report) {
    // Determine expected tables
    let models = {};
    if (type === 'control_plane') {
        const cp = require('../control_plane_models');
        models = {
            brands: cp.Brand,
            tenant_connections: cp.TenantConnection,
            subscriptions: cp.Subscription,
            plans: cp.Plan,
            cluster_metadata: cp.ClusterMetadata,
            super_admin_users: cp.SuperAdminUser,
            tenant_migration_log: cp.TenantMigrationLog,
            audit_logs: cp.AuditLog
        };
    } else {
        try {
            const tModels = await initializeTenantModels(sequelize);
            for (const [name, model] of Object.entries(tModels)) {
                if (model && model.tableName) models[model.tableName] = model;
            }
        } catch (e) {
            console.warn(`  ⚠️ Model-based audit restricted: ${e.message}`);
        }
    }

    // Get DB tables
    const dbTablesRes = await sequelize.query(`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `, { type: Sequelize.QueryTypes.SELECT });
    report.tablesDetected = dbTablesRes.map(t => (t.table_name || t.TABLE_NAME || Object.values(t)[0]).toLowerCase());

    const expectedTables = type === 'tenant' ? Object.keys(REQUIRED_TENANT_SCHEMA) : Object.keys(models);

    for (const tableName of expectedTables) {
        if (!report.tablesDetected.includes(tableName.toLowerCase())) {
            report.missingTables.push(tableName);
            report.migrations.push(`-- TODO: Missing table ${tableName}. Suggest running full migration sync.`);
            continue;
        }

        console.log(`  - Auditing: ${tableName}`);
        const dbColsRes = await sequelize.query(`
            SELECT column_name FROM information_schema.columns WHERE table_name = :tableName
        `, { replacements: { tableName }, type: Sequelize.QueryTypes.SELECT });
        const existingCols = dbColsRes.map(c => (c.column_name || c.COLUMN_NAME || Object.values(c)[0]).toLowerCase());

        const required = REQUIRED_TENANT_SCHEMA[tableName] || [];
        const model = models[tableName];
        
        // Audit based on REQUIRED_TENANT_SCHEMA + Model Fields
        const allRequiredFields = new Set(required);
        if (model) Object.keys(model.rawAttributes).forEach(k => {
            const attr = model.rawAttributes[k];
            allRequiredFields.add(attr.field || attr.name || k.replace(/([A-Z])/g, "_$1").toLowerCase());
        });

        for (const field of allRequiredFields) {
            const dbCol = field.toLowerCase();
            if (!existingCols.includes(dbCol)) {
                report.missingColumns.push({ table: tableName, column: dbCol });
                // Infer type
                let type = 'UUID';
                if (dbCol === 'name' || dbCol === 'email' || dbCol === 'description' || dbCol === 'address' || dbCol === 'phone') type = 'VARCHAR(255)';
                else if (dbCol.startsWith('is_') || dbCol.startsWith('track_')) type = 'BOOLEAN';
                else if (dbCol === 'status' || dbCol === 'role' || dbCol === 'payment_method' || dbCol === 'order_type') type = 'VARCHAR(255)';
                else if (dbCol.endsWith('_id') || dbCol === 'id') type = 'UUID';
                else if (dbCol === 'quantity' || dbCol === 'sort_order' || dbCol === 'capacity') type = 'INTEGER';
                else if (dbCol.includes('stock') || dbCol.includes('amount') || dbCol.includes('price') || dbCol.includes('tax')) type = 'DECIMAL(10,2)';
                else if (dbCol.endsWith('_at') || dbCol.endsWith('_date') || dbCol === 'last_updated') type = 'TIMESTAMP WITH TIME ZONE';
                else type = 'VARCHAR(255)'; // Final fallback

                report.migrations.push(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${dbCol} ${type};`);
            }
        }
        
        // Ensure index on outlet_id
        if (allRequiredFields.has('outlet_id')) {
            report.migrations.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_outlet ON ${tableName}(outlet_id);`);
        }
        if (allRequiredFields.has('business_id')) {
            report.migrations.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_business ON ${tableName}(business_id);`);
        }
    }

    // Add CREATE TABLE for missing tables in report
    for (const tableName of report.missingTables) {
        if (REQUIRED_TENANT_SCHEMA[tableName]) {
            let createSql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid()`;
            for (const col of REQUIRED_TENANT_SCHEMA[tableName]) {
                if (col === 'id') continue;
                let type = 'UUID';
                if (col === 'name' || col === 'email') type = 'VARCHAR(255)';
                else if (col.startsWith('is_')) type = 'BOOLEAN';
                else if (col.endsWith('_id')) type = 'UUID';
                else if (col === 'quantity' || col === 'sort_order') type = 'INTEGER';
                else if (col.includes('amount') || col.includes('price')) type = 'DECIMAL(10,2)';
                else if (col.endsWith('_at') || col === 'last_updated') type = 'TIMESTAMP WITH TIME ZONE';
                createSql += `,\n  ${col} ${type}`;
            }
            createSql += `,\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`;
            createSql += `,\n  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`;
            createSql += `\n);`;
            report.migrations.push(createSql);
        }
    }
}

function generateMigrationFile(report) {
    let sql = `-- IDEMPOTENT SCHEMA FIXES\n-- Generated on ${new Date().toISOString()}\n\n`;
    
    sql += `-- [CONTROL PLANE]\n`;
    report.controlPlane.migrations.forEach(m => sql += m + '\n');
    
    sql += `\n-- [TENANTS]\n`;
    const seen = new Set();
    report.tenants.forEach(t => {
        if (t.migrations) t.migrations.forEach(m => {
            if (!seen.has(m)) {
                sql += m + '\n';
                seen.add(m);
            }
        });
    });
    
    fs.writeFileSync('scripts/generated_schema_fixes.sql', sql);
}

auditDatabase();
