#!/usr/bin/env node

/**
 * COMPREHENSIVE SCHEMA VERIFICATION SCRIPT
 * 
 * This script performs a complete schema verification for the multi-tenant POS system
 * including control plane and tenant databases, model comparisons, and API validation.
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

// ANSI color codes for better output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function log(level, message) {
    const timestamp = new Date().toISOString();
    const color = colors[level] || colors.white;
    console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

function logSuccess(message) { log('green', `✅ ${message}`); }
function logError(message) { log('red', `❌ ${message}`); }
function logWarning(message) { log('yellow', `⚠️ ${message}`); }
function logInfo(message) { log('blue', `ℹ️ ${message}`); }
function logSection(message) { log('magenta', `\n🔍 ${message}`); }

class SchemaVerifier {
    constructor() {
        this.issues = [];
        this.warnings = [];
        this.controlPlaneModels = {};
        this.tenantModels = {};
        this.controlPlaneSchema = {};
        this.tenantSchema = {};
    }

    async initialize() {
        logSection('INITIALIZING SCHEMA VERIFICATION');
        
        try {
            // Initialize Control Plane Connection
            const controlPlaneUrl = process.env.CONTROL_PLANE_DATABASE_URL;
            if (!controlPlaneUrl) {
                throw new Error('CONTROL_PLANE_DATABASE_URL not set');
            }
            
            this.controlPlaneSequelize = new Sequelize(controlPlaneUrl, {
                dialect: 'postgres',
                logging: false,
                dialectOptions: {
                    ssl: process.env.NODE_ENV === 'production' ? { require: true, rejectUnauthorized: false } : false
                }
            });
            
            await this.controlPlaneSequelize.authenticate();
            logSuccess('Control Plane database connected');
            
            // Initialize Tenant Connection
            const tenantUrl = process.env.DATABASE_URL;
            if (!tenantUrl) {
                throw new Error('DATABASE_URL not set');
            }
            
            this.tenantSequelize = new Sequelize(tenantUrl, {
                dialect: 'postgres',
                logging: false,
                dialectOptions: {
                    ssl: process.env.NODE_ENV === 'production' ? { require: true, rejectUnauthorized: false } : false
                }
            });
            
            await this.tenantSequelize.authenticate();
            logSuccess('Tenant database connected');
            
        } catch (error) {
            logError(`Database connection failed: ${error.message}`);
            throw error;
        }
    }

    async loadModels() {
        logSection('LOADING SEQUELIZE MODELS');
        
        try {
            // Load Control Plane Models
            const controlPlaneModelFiles = [
                'businessModel', 'tenantConnectionModel', 'subscriptionModel', 
                'planModel', 'superAdminModel', 'auditLogModel',
                'clusterMetadataModel', 'tenantMigrationLogModel'
            ];
            
            for (const modelFile of controlPlaneModelFiles) {
                try {
                    const modelPath = `./control_plane_models/${modelFile}`;
                    const modelDef = require(modelPath);
                    const modelName = modelFile.replace('Model', '');
                    
                    // Initialize model with sequelize
                    if (typeof modelDef === 'function') {
                        this.controlPlaneModels[modelName] = modelDef(this.controlPlaneSequelize, Sequelize.DataTypes);
                    } else if (modelDef.default) {
                        this.controlPlaneModels[modelName] = modelDef.default;
                    } else if (modelDef[modelName]) {
                        this.controlPlaneModels[modelName] = modelDef[modelName];
                    }
                    
                    logSuccess(`Loaded control plane model: ${modelName}`);
                } catch (error) {
                    logWarning(`Failed to load control plane model ${modelFile}: ${error.message}`);
                }
            }
            
            // Load Tenant Models
            const tenantModelFiles = [
                'userModel', 'businessModel', 'outletModel', 'categoryModel',
                'productModel', 'productTypeModel', 'orderModel', 'orderItemModel',
                'tableModel', 'areaModel', 'inventoryModel', 'inventoryItemModel',
                'supplierModel', 'customerModel', 'paymentModel', 'transactionModel',
                'expenseModel', 'expenseTypeModel', 'recipeModel', 'recipeItemModel',
                'billingConfigModel', 'settingModel', 'featureFlagModel', 'timingModel',
                'accountModel', 'customerLedgerModel', 'customerTransactionModel',
                'incomeModel', 'inventoryCategoryModel', 'inventoryTransactionModel',
                'membershipPlanModel', 'partnerMembershipModel', 'partnerTypeModel',
                'partnerWalletModel', 'purchaseModel', 'purchaseItemModel',
                'rollTrackingModel', 'subscriptionModel', 'webContentModel'
            ];
            
            for (const modelFile of tenantModelFiles) {
                try {
                    const modelPath = `./models/${modelFile}`;
                    const modelDef = require(modelPath);
                    const modelName = modelFile.replace('Model', '');
                    
                    // Initialize model with sequelize
                    if (typeof modelDef === 'function') {
                        this.tenantModels[modelName] = modelDef(this.tenantSequelize);
                    } else if (modelDef.default) {
                        this.tenantModels[modelName] = modelDef.default;
                    } else if (modelDef[modelName]) {
                        this.tenantModels[modelName] = modelDef[modelName];
                    }
                    
                    logSuccess(`Loaded tenant model: ${modelName}`);
                } catch (error) {
                    logWarning(`Failed to load tenant model ${modelFile}: ${error.message}`);
                }
            }
            
        } catch (error) {
            logError(`Model loading failed: ${error.message}`);
            throw error;
        }
    }

    async extractDatabaseSchemas() {
        logSection('EXTRACTING DATABASE SCHEMAS');
        
        try {
            // Extract Control Plane Schema
            const controlPlaneTables = await this.controlPlaneSequelize.getQueryInterface().showAllTables();
            logInfo(`Found ${controlPlaneTables.length} control plane tables`);
            
            for (const tableName of controlPlaneTables) {
                const columns = await this.controlPlaneSequelize.getQueryInterface().describeTable(tableName);
                const indexes = await this.controlPlaneSequelize.getQueryInterface().showIndex(tableName);
                const foreignKeys = await this.controlPlaneSequelize.getQueryInterface().getForeignKeyReferencesForTable(tableName);
                
                this.controlPlaneSchema[tableName] = {
                    columns,
                    indexes,
                    foreignKeys
                };
            }
            
            // Extract Tenant Schema
            const tenantTables = await this.tenantSequelize.getQueryInterface().showAllTables();
            logInfo(`Found ${tenantTables.length} tenant tables`);
            
            for (const tableName of tenantTables) {
                const columns = await this.tenantSequelize.getQueryInterface().describeTable(tableName);
                const indexes = await this.tenantSequelize.getQueryInterface().showIndex(tableName);
                const foreignKeys = await this.tenantSequelize.getQueryInterface().getForeignKeyReferencesForTable(tableName);
                
                this.tenantSchema[tableName] = {
                    columns,
                    indexes,
                    foreignKeys
                };
            }
            
        } catch (error) {
            logError(`Schema extraction failed: ${error.message}`);
            throw error;
        }
    }

    validateCriticalFields() {
        logSection('VALIDATING CRITICAL FIELDS');
        
        // Control Plane Critical Fields
        const controlPlaneRequirements = {
            businesses: ['id', 'name', 'email', 'gst_number', 'status', 'created_at', 'updated_at'],
            tenant_connections: ['id', 'business_id', 'db_name', 'db_host', 'db_user', 'encrypted_password', 'status', 'pool_max_connections', 'db_region'],
            subscriptions: ['id', 'business_id', 'plan_id', 'status', 'created_at', 'updated_at'],
            plans: ['id', 'name', 'slug', 'price', 'created_at', 'updated_at'],
            super_admin_users: ['id', 'email', 'password_hash', 'role', 'created_at', 'updated_at'],
            audit_logs: ['id', 'user_id', 'brand_id', 'action_type', 'created_at']
        };
        
        // Tenant Critical Fields
        const tenantRequirements = {
            businesses: ['id', 'name', 'email', 'gst_number', 'business_id', 'created_at', 'updated_at'],
            users: ['id', 'business_id', 'outlet_id', 'name', 'email', 'password_hash', 'role', 'created_at', 'updated_at'],
            outlets: ['id', 'business_id', 'name', 'created_at', 'updated_at'],
            categories: ['id', 'business_id', 'outlet_id', 'name', 'created_at', 'updated_at'],
            products: ['id', 'business_id', 'outlet_id', 'category_id', 'name', 'price', 'is_available', 'created_at', 'updated_at'],
            orders: ['id', 'business_id', 'outlet_id', 'order_number', 'status', 'billing_total', 'created_at', 'updated_at'],
            tables: ['id', 'business_id', 'outlet_id', 'area_id', 'name', 'created_at', 'updated_at'],
            areas: ['id', 'business_id', 'outlet_id', 'name', 'created_at', 'updated_at']
        };
        
        // Validate Control Plane
        for (const [table, requiredFields] of Object.entries(controlPlaneRequirements)) {
            if (!this.controlPlaneSchema[table]) {
                this.issues.push(`Missing control plane table: ${table}`);
                continue;
            }
            
            const tableColumns = Object.keys(this.controlPlaneSchema[table].columns);
            for (const field of requiredFields) {
                if (!tableColumns.includes(field)) {
                    this.issues.push(`Missing field ${field} in control plane table ${table}`);
                }
            }
        }
        
        // Validate Tenant
        for (const [table, requiredFields] of Object.entries(tenantRequirements)) {
            if (!this.tenantSchema[table]) {
                this.issues.push(`Missing tenant table: ${table}`);
                continue;
            }
            
            const tableColumns = Object.keys(this.tenantSchema[table].columns);
            for (const field of requiredFields) {
                if (!tableColumns.includes(field)) {
                    this.issues.push(`Missing field ${field} in tenant table ${table}`);
                }
            }
        }
    }

    validateModelVsDatabase() {
        logSection('VALIDATING MODEL VS DATABASE CONSISTENCY');
        
        // Compare Control Plane Models with Database
        for (const [modelName, model] of Object.entries(this.controlPlaneModels)) {
            const tableName = model.getTableName();
            
            if (!this.controlPlaneSchema[tableName]) {
                this.issues.push(`Model ${modelName} references non-existent table ${tableName}`);
                continue;
            }
            
            const modelAttributes = model.rawAttributes;
            const dbColumns = this.controlPlaneSchema[tableName].columns;
            
            // Check for missing columns in database
            for (const [attrName, attrDef] of Object.entries(modelAttributes)) {
                const fieldName = attrDef.field || attrName;
                if (!dbColumns[fieldName] && attrName !== 'id' && attrName !== 'createdAt' && attrName !== 'updatedAt') {
                    this.issues.push(`Model ${modelName} field ${attrName} (${fieldName}) not found in database table ${tableName}`);
                }
            }
            
            // Check for extra columns in database
            for (const columnName of Object.keys(dbColumns)) {
                const modelField = Object.values(modelAttributes).find(attr => (attr.field || attr.name) === columnName);
                if (!modelField && columnName !== 'id' && columnName !== 'created_at' && columnName !== 'updated_at') {
                    this.warnings.push(`Database column ${tableName}.${columnName} not defined in model ${modelName}`);
                }
            }
        }
        
        // Compare Tenant Models with Database
        for (const [modelName, model] of Object.entries(this.tenantModels)) {
            const tableName = model.getTableName();
            
            if (!this.tenantSchema[tableName]) {
                this.issues.push(`Model ${modelName} references non-existent table ${tableName}`);
                continue;
            }
            
            const modelAttributes = model.rawAttributes;
            const dbColumns = this.tenantSchema[tableName].columns;
            
            // Check for missing columns in database
            for (const [attrName, attrDef] of Object.entries(modelAttributes)) {
                const fieldName = attrDef.field || attrName;
                if (!dbColumns[fieldName] && attrName !== 'id' && attrName !== 'createdAt' && attrName !== 'updatedAt') {
                    this.issues.push(`Model ${modelName} field ${attrName} (${fieldName}) not found in database table ${tableName}`);
                }
            }
            
            // Check for extra columns in database
            for (const columnName of Object.keys(dbColumns)) {
                const modelField = Object.values(modelAttributes).find(attr => (attr.field || attr.name) === columnName);
                if (!modelField && columnName !== 'id' && columnName !== 'created_at' && columnName !== 'updated_at') {
                    this.warnings.push(`Database column ${tableName}.${columnName} not defined in model ${modelName}`);
                }
            }
        }
    }

    validateAssociations() {
        logSection('VALIDATING ASSOCIATIONS AND FOREIGN KEYS');
        
        // Check critical foreign key relationships
        const criticalFKs = [
            { table: 'users', fk: 'business_id', references: 'businesses.id' },
            { table: 'users', fk: 'outlet_id', references: 'outlets.id' },
            { table: 'outlets', fk: 'business_id', references: 'businesses.id' },
            { table: 'categories', fk: 'business_id', references: 'businesses.id' },
            { table: 'categories', fk: 'outlet_id', references: 'outlets.id' },
            { table: 'products', fk: 'business_id', references: 'businesses.id' },
            { table: 'products', fk: 'outlet_id', references: 'outlets.id' },
            { table: 'products', fk: 'category_id', references: 'categories.id' },
            { table: 'orders', fk: 'business_id', references: 'businesses.id' },
            { table: 'orders', fk: 'outlet_id', references: 'outlets.id' },
            { table: 'tables', fk: 'business_id', references: 'businesses.id' },
            { table: 'tables', fk: 'outlet_id', references: 'outlets.id' },
            { table: 'tables', fk: 'area_id', references: 'areas.id' },
            { table: 'areas', fk: 'business_id', references: 'businesses.id' },
            { table: 'areas', fk: 'outlet_id', references: 'outlets.id' },
            { table: 'tenant_connections', fk: 'business_id', references: 'businesses.id' }
        ];
        
        for (const fk of criticalFKs) {
            const schema = fk.table === 'tenant_connections' ? this.controlPlaneSchema : this.tenantSchema;
            
            if (!schema[fk.table]) {
                this.issues.push(`Table ${fk.table} not found for foreign key validation`);
                continue;
            }
            
            const tableColumns = Object.keys(schema[fk.table].columns);
            if (!tableColumns.includes(fk.fk)) {
                this.issues.push(`Foreign key column ${fk.table}.${fk.fk} not found`);
            }
        }
    }

    validateMultiTenantIsolation() {
        logSection('VALIDATING MULTI-TENANT ISOLATION');
        
        // Ensure no tenant data in control plane
        const tenantOnlyTables = ['users', 'outlets', 'categories', 'products', 'orders', 'tables', 'areas'];
        
        for (const table of tenantOnlyTables) {
            if (this.controlPlaneSchema[table]) {
                this.issues.push(`Tenant table ${table} found in control plane database - isolation violation!`);
            }
        }
        
        // Ensure all tenant tables have business_id
        for (const [tableName, schema] of Object.entries(this.tenantSchema)) {
            if (tableName !== 'sequelize_meta' && tableName !== 'sequelize_migration_lock') {
                const columns = Object.keys(schema.columns);
                if (!columns.includes('business_id')) {
                    this.warnings.push(`Tenant table ${tableName} missing business_id column`);
                }
            }
        }
    }

    generateFixes() {
        logSection('GENERATING FIXES');
        
        const fixes = {
            sql: [],
            model: []
        };
        
        // Generate SQL fixes for missing columns
        for (const issue of this.issues) {
            if (issue.includes('Missing field') && issue.includes('in')) {
                const match = issue.match(/Missing field (\w+) in (control plane|tenant) table (\w+)/);
                if (match) {
                    const [, field, dbType, table] = match;
                    const dataType = this.inferDataType(field);
                    fixes.sql.push(`ALTER TABLE ${table} ADD COLUMN ${field} ${dataType};`);
                }
            }
        }
        
        return fixes;
    }

    inferDataType(fieldName) {
        const fieldPatterns = {
            id: 'UUID',
            business_id: 'UUID',
            outlet_id: 'UUID',
            category_id: 'UUID',
            area_id: 'UUID',
            user_id: 'UUID',
            brand_id: 'UUID',
            plan_id: 'UUID',
            name: 'VARCHAR(255)',
            email: 'VARCHAR(255)',
            password_hash: 'TEXT',
            gst_number: 'VARCHAR(50)',
            status: 'VARCHAR(50)',
            role: 'VARCHAR(50)',
            description: 'TEXT',
            price: 'DECIMAL(15,2)',
            is_available: 'BOOLEAN',
            is_active: 'BOOLEAN',
            created_at: 'TIMESTAMP',
            updated_at: 'TIMESTAMP'
        };
        
        return fieldPatterns[fieldName] || 'VARCHAR(255)';
    }

    async generateReport() {
        logSection('GENERATING COMPREHENSIVE REPORT');
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 COMPREHENSIVE SCHEMA VERIFICATION REPORT');
        console.log('='.repeat(80));
        
        console.log(`\n📈 STATISTICS:`);
        console.log(`   Control Plane Models: ${Object.keys(this.controlPlaneModels).length}`);
        console.log(`   Tenant Models: ${Object.keys(this.tenantModels).length}`);
        console.log(`   Control Plane Tables: ${Object.keys(this.controlPlaneSchema).length}`);
        console.log(`   Tenant Tables: ${Object.keys(this.tenantSchema).length}`);
        console.log(`   Critical Issues: ${this.issues.length}`);
        console.log(`   Warnings: ${this.warnings.length}`);
        
        if (this.issues.length > 0) {
            console.log(`\n🚨 CRITICAL ISSUES FOUND:`);
            for (let i = 0; i < this.issues.length; i++) {
                console.log(`   ${i + 1}. ${this.issues[i]}`);
            }
        }
        
        if (this.warnings.length > 0) {
            console.log(`\n⚠️ WARNINGS:`);
            for (let i = 0; i < this.warnings.length; i++) {
                console.log(`   ${i + 1}. ${this.warnings[i]}`);
            }
        }
        
        const fixes = this.generateFixes();
        
        if (fixes.sql.length > 0) {
            console.log(`\n🔧 SUGGESTED SQL FIXES:`);
            for (const sql of fixes.sql) {
                console.log(`   ${sql}`);
            }
        }
        
        const isProductionReady = this.issues.length === 0;
        
        console.log(`\n🔒 PRODUCTION READINESS STATUS:`);
        console.log(`   Status: ${isProductionReady ? '✅ PRODUCTION READY' : '❌ FIXES REQUIRED'}`);
        console.log(`   Multi-tenant Isolation: ${this.issues.filter(i => i.includes('isolation violation')).length === 0 ? '✅ SECURE' : '❌ COMPROMISED'}`);
        console.log(`   Schema Consistency: ${this.issues.filter(i => i.includes('not found')).length === 0 ? '✅ CONSISTENT' : '❌ INCONSISTENT'}`);
        
        console.log('\n' + '='.repeat(80));
        
        return {
            isProductionReady,
            issuesCount: this.issues.length,
            warningsCount: this.warnings.length,
            issues: this.issues,
            warnings: this.warnings,
            fixes
        };
    }

    async cleanup() {
        if (this.controlPlaneSequelize) {
            await this.controlPlaneSequelize.close();
        }
        if (this.tenantSequelize) {
            await this.tenantSequelize.close();
        }
    }
}

// Main execution
async function main() {
    const verifier = new SchemaVerifier();
    
    try {
        await verifier.initialize();
        await verifier.loadModels();
        await verifier.extractDatabaseSchemas();
        verifier.validateCriticalFields();
        verifier.validateModelVsDatabase();
        verifier.validateAssociations();
        verifier.validateMultiTenantIsolation();
        
        const report = await verifier.generateReport();
        
        // Exit with appropriate code
        process.exit(report.isProductionReady ? 0 : 1);
        
    } catch (error) {
        logError(`Schema verification failed: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await verifier.cleanup();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = SchemaVerifier;
