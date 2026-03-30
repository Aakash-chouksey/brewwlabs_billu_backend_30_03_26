/**
 * DATABASE vs MODEL VALIDATION SCRIPT
 * Multi-tenant POS System - March 2026
 * 
 * This script compares Sequelize models with actual database schemas
 * to identify mismatches, missing columns, and structural issues.
 */

const { sequelize } = require('../config/unified_database');
const neonTransactionSafeExecutor = require('../services/neonTransactionSafeExecutor');

class DatabaseModelValidator {
    constructor() {
        this.issues = [];
        this.fixes = [];
        this.warnings = [];
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${level}: ${message}`;
        console.log(logEntry);
        if (data) {
            console.log('Data:', JSON.stringify(data, null, 2));
        }
        
        if (level === 'ISSUE') this.issues.push({ message, data, timestamp });
        if (level === 'FIX') this.fixes.push({ message, data, timestamp });
        if (level === 'WARNING') this.warnings.push({ message, data, timestamp });
    }

    async validateAllTenants() {
        this.log('INFO', '🔍 Starting database vs model validation for all tenants...');
        
        try {
            // Get all active tenants
            const tenants = await this.getAllTenants();
            this.log('INFO', `Found ${tenants.length} tenants to validate`);

            for (const tenant of tenants) {
                await this.validateTenantSchema(tenant);
            }

            // Validate control plane models
            await this.validateControlPlaneModels();

            // Generate report
            this.generateReport();

        } catch (error) {
            this.log('ISSUE', 'Critical error during validation', { error: error.message });
        }
    }

    async getAllTenants() {
        const result = await sequelize.query(`
            SELECT tr.business_id, tr.schema_name, tr.status, tr.activated_at,
                   b.name as business_name, b.email as business_email
            FROM tenant_registry tr
            JOIN businesses b ON tr.business_id = b.id
            WHERE tr.status = 'ACTIVE'
            ORDER BY tr.created_at DESC
        `, { type: sequelize.QueryTypes.SELECT });

        return result;
    }

    async validateTenantSchema(tenant) {
        this.log('INFO', `🏢 Validating tenant schema: ${tenant.schema_name}`);
        
        try {
            await neonTransactionSafeExecutor.executeInTenant(tenant.schema_name, async (context) => {
                const { transactionModels: models } = context;
                
                // Define required models and their critical columns
                const requiredModels = {
                    'Table': {
                        model: models.Table,
                        requiredColumns: ['id', 'businessId', 'outletId', 'name', 'tableNo', 'status', 'currentOrderId'],
                        criticalDefaults: { status: 'AVAILABLE' }
                    },
                    'Order': {
                        model: models.Order,
                        requiredColumns: ['id', 'businessId', 'outletId', 'tableId', 'status', 'orderNumber'],
                        criticalDefaults: { status: 'PENDING' }
                    },
                    'OrderItem': {
                        model: models.OrderItem,
                        requiredColumns: ['id', 'orderId', 'productId', 'quantity', 'price'],
                        criticalDefaults: {}
                    },
                    'Product': {
                        model: models.Product,
                        requiredColumns: ['id', 'businessId', 'name', 'price'],
                        criticalDefaults: { isActive: true }
                    },
                    'Category': {
                        model: models.Category,
                        requiredColumns: ['id', 'businessId', 'name'],
                        criticalDefaults: { isEnabled: true }
                    },
                    'Area': {
                        model: models.Area,
                        requiredColumns: ['id', 'businessId', 'outletId', 'name'],
                        criticalDefaults: { status: 'active' }
                    },
                    'Outlet': {
                        model: models.Outlet,
                        requiredColumns: ['id', 'businessId', 'name'],
                        criticalDefaults: { status: 'active', isActive: true }
                    }
                };

                // Validate each model
                for (const [modelName, config] of Object.entries(requiredModels)) {
                    await this.validateModel(modelName, config, tenant, context);
                }
            });
        } catch (error) {
            this.log('ISSUE', `Failed to validate tenant ${tenant.schema_name}`, { error: error.message });
        }
    }

    async validateModel(modelName, config, tenant, context) {
        try {
            const { model, requiredColumns, criticalDefaults } = config;
            
            // Check if model exists
            if (!model) {
                this.log('ISSUE', `Model ${modelName} not found in tenant ${tenant.schema_name}`);
                return;
            }

            // Get actual table schema
            const tableName = model.getTableName();
            const tableSchema = await this.getTableSchema(tenant.schema_name, tableName);
            
            if (!tableSchema) {
                this.log('ISSUE', `Table ${tableName} not found in database for tenant ${tenant.schema_name}`);
                return;
            }

            // Check for missing columns
            const modelAttributes = Object.keys(model.rawAttributes || {});
            const dbColumns = tableSchema.map(col => col.column_name);
            
            const missingColumns = requiredColumns.filter(col => !dbColumns.includes(col));
            if (missingColumns.length > 0) {
                this.log('ISSUE', `Missing columns in ${tableName} for tenant ${tenant.schema_name}`, {
                    missingColumns,
                    existingColumns: dbColumns,
                    modelAttributes
                });
            }

            // Check for extra columns (might indicate migration issues)
            const extraColumns = dbColumns.filter(col => !modelAttributes.includes(col) && col !== 'created_at' && col !== 'updated_at');
            if (extraColumns.length > 0) {
                this.log('WARNING', `Extra columns in ${tableName} for tenant ${tenant.schema_name}`, {
                    extraColumns,
                    modelAttributes
                });
            }

            // Check column types and constraints
            await this.validateColumnTypes(modelName, model, tableSchema, tenant);

            // Check critical defaults
            await this.validateCriticalDefaults(modelName, model, criticalDefaults, tenant, context);

            // Check foreign key constraints
            await this.validateForeignKeys(modelName, model, tableSchema, tenant);

            this.log('FIX', `✅ Model ${modelName} validated for tenant ${tenant.schema_name}`);

        } catch (error) {
            this.log('ISSUE', `Failed to validate model ${modelName} for tenant ${tenant.schema_name}`, { error: error.message });
        }
    }

    async getTableSchema(schemaName, tableName) {
        try {
            const result = await sequelize.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_schema = :schemaName 
                AND table_name = :tableName
                ORDER BY ordinal_position
            `, {
                replacements: { schemaName, tableName },
                type: sequelize.QueryTypes.SELECT
            });
            return result;
        } catch (error) {
            this.log('ISSUE', `Failed to get schema for ${schemaName}.${tableName}`, { error: error.message });
            return null;
        }
    }

    async validateColumnTypes(modelName, model, tableSchema, tenant) {
        const modelAttributes = model.rawAttributes || {};
        
        for (const [attrName, attrDef] of Object.entries(modelAttributes)) {
            const dbColumn = tableSchema.find(col => col.column_name === attrDef.field);
            
            if (!dbColumn) {
                // Skip if column doesn't exist (already reported as missing)
                continue;
            }

            // Check critical type mismatches
            const modelType = this.getSequelizeType(attrDef.type);
            const dbType = dbColumn.data_type.toLowerCase();
            
            if (this.isTypeMismatch(modelType, dbType, attrName)) {
                this.log('ISSUE', `Type mismatch in ${modelName}.${attrName} for tenant ${tenant.schema_name}`, {
                    modelType,
                    dbType,
                    modelDefinition: attrDef,
                    dbDefinition: dbColumn
                });
            }
        }
    }

    getSequelizeType(sequelizeType) {
        if (sequelizeType instanceof sequelize.Sequelize.UUID) return 'uuid';
        if (sequelizeType instanceof sequelize.Sequelize.STRING) return 'string';
        if (sequelizeType instanceof sequelize.Sequelize.INTEGER) return 'integer';
        if (sequelizeType instanceof sequelize.Sequelize.DECIMAL) return 'decimal';
        if (sequelizeType instanceof sequelize.Sequelize.BOOLEAN) return 'boolean';
        if (sequelizeType instanceof sequelize.Sequelize.DATE) return 'timestamp';
        if (sequelizeType instanceof sequelize.Sequelize.TEXT) return 'text';
        return 'unknown';
    }

    isTypeMismatch(modelType, dbType, columnName) {
        // Allow some type flexibility
        const typeMap = {
            'uuid': ['uuid', 'character varying'],
            'string': ['character varying', 'varchar', 'text'],
            'integer': ['integer', 'bigint'],
            'decimal': ['numeric', 'decimal'],
            'boolean': ['boolean', 'tinyint'],
            'timestamp': ['timestamp', 'timestamptz']
        };

        const allowedTypes = typeMap[modelType] || [];
        return !allowedTypes.includes(dbType) && !columnName.includes('_id'); // Skip FK type checks
    }

    async validateCriticalDefaults(modelName, model, criticalDefaults, tenant, context) {
        try {
            // Check if any records exist with null critical values
            for (const [column, expectedDefault] of Object.entries(criticalDefaults)) {
                const tableName = model.getTableName();
                
                const result = await context.sequelize.query(`
                    SELECT COUNT(*) as count
                    FROM "${tableName}"
                    WHERE business_id = :businessId 
                    AND (${column} IS NULL OR ${column} = '')
                `, {
                    replacements: { businessId: tenant.business_id },
                    type: context.sequelize.QueryTypes.SELECT
                });

                const nullCount = result[0].count;
                if (nullCount > 0) {
                    this.log('ISSUE', `Critical default violation in ${tableName}.${column} for tenant ${tenant.schema_name}`, {
                        column,
                        expectedDefault,
                        nullCount,
                        query: `WHERE ${column} IS NULL OR ${column} = ''`
                    });
                }
            }
        } catch (error) {
            this.log('WARNING', `Failed to validate defaults for ${modelName}`, { error: error.message });
        }
    }

    async validateForeignKeys(modelName, model, tableSchema, tenant) {
        const modelAttributes = model.rawAttributes || {};
        
        // Check for foreign key columns that should be NOT NULL
        const fkColumns = Object.entries(modelAttributes)
            .filter(([name, def]) => name.includes('Id') && def.allowNull === false);

        for (const [fkColumn, def] of fkColumns) {
            const dbColumn = tableSchema.find(col => col.column_name === def.field);
            
            if (dbColumn && dbColumn.is_nullable === 'YES') {
                this.log('ISSUE', `Foreign key ${modelName}.${fkColumn} should be NOT NULL in database for tenant ${tenant.schema_name}`, {
                    column: fkColumn,
                    dbNullable: dbColumn.is_nullable,
                    modelNullable: def.allowNull
                });
            }
        }
    }

    async validateControlPlaneModels() {
        this.log('INFO', '🌐 Validating control plane models...');
        
        try {
            const controlPlaneModels = {
                'Business': {
                    requiredColumns: ['id', 'name', 'email', 'status', 'isActive'],
                    criticalDefaults: { isActive: true }
                },
                'User': {
                    requiredColumns: ['id', 'businessId', 'email', 'role', 'isActive'],
                    criticalDefaults: { isActive: true }
                },
                'TenantRegistry': {
                    requiredColumns: ['id', 'businessId', 'schemaName', 'status'],
                    criticalDefaults: {}
                }
            };

            for (const [modelName, config] of Object.entries(controlPlaneModels)) {
                await this.validateControlPlaneModel(modelName, config);
            }
        } catch (error) {
            this.log('ISSUE', 'Failed to validate control plane models', { error: error.message });
        }
    }

    async validateControlPlaneModel(modelName, config) {
        try {
            const model = sequelize.models[modelName];
            if (!model) {
                this.log('ISSUE', `Control plane model ${modelName} not found`);
                return;
            }

            const tableName = model.getTableName();
            const tableSchema = await this.getTableSchema('public', tableName);
            
            if (!tableSchema) {
                this.log('ISSUE', `Control plane table ${tableName} not found`);
                return;
            }

            const modelAttributes = Object.keys(model.rawAttributes || {});
            const dbColumns = tableSchema.map(col => col.column_name);
            
            const missingColumns = config.requiredColumns.filter(col => !dbColumns.includes(col));
            if (missingColumns.length > 0) {
                this.log('ISSUE', `Missing columns in control plane ${tableName}`, {
                    missingColumns,
                    existingColumns: dbColumns
                });
            }

            this.log('FIX', `✅ Control plane model ${modelName} validated`);
        } catch (error) {
            this.log('ISSUE', `Failed to validate control plane model ${modelName}`, { error: error.message });
        }
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 DATABASE vs MODEL VALIDATION REPORT');
        console.log('='.repeat(80));
        
        console.log(`\n🚨 ISSUES FOUND: ${this.issues.length}`);
        this.issues.forEach((issue, index) => {
            console.log(`\n${index + 1}. ${issue.message}`);
            if (issue.data) {
                console.log('   Details:', JSON.stringify(issue.data, null, 2));
            }
        });

        console.log(`\n⚠️  WARNINGS: ${this.warnings.length}`);
        this.warnings.forEach((warning, index) => {
            console.log(`\n${index + 1}. ${warning.message}`);
            if (warning.data) {
                console.log('   Details:', JSON.stringify(warning.data, null, 2));
            }
        });

        console.log(`\n✅ FIXES VERIFIED: ${this.fixes.length}`);
        this.fixes.forEach((fix, index) => {
            console.log(`\n${index + 1}. ${fix.message}`);
        });

        // Summary
        const totalIssues = this.issues.length + this.warnings.length;
        if (totalIssues === 0) {
            console.log('\n🎉 DATABASE SCHEMA IS HEALTHY - No issues found!');
        } else {
            console.log(`\n📋 SUMMARY: ${totalIssues} schema issues need attention`);
            console.log(`   - Critical Issues: ${this.issues.length}`);
            console.log(`   - Warnings: ${this.warnings.length}`);
        }

        console.log('\n' + '='.repeat(80));
    }

    async generateMigrationFixes() {
        this.log('INFO', '🔧 Generating migration fixes for identified issues...');
        
        const migrationStatements = [];
        
        // Group issues by tenant and table
        const issuesByTenant = {};
        for (const issue of this.issues) {
            if (issue.data && issue.data.missingColumns) {
                const tenant = issue.message.match(/tenant (\w+)/)?.[1];
                const table = issue.message.match(/in (\w+)/)?.[1];
                
                if (tenant && table) {
                    const key = `${tenant}.${table}`;
                    if (!issuesByTenant[key]) {
                        issuesByTenant[key] = { tenant, table, columns: [] };
                    }
                    issuesByTenant[key].columns.push(...issue.data.missingColumns);
                }
            }
        }

        // Generate ALTER TABLE statements
        for (const [key, config] of Object.entries(issuesByTenant)) {
            const { tenant, table, columns } = config;
            
            for (const column of columns) {
                // Determine column type based on name
                let columnType = 'VARCHAR(255)';
                if (column.includes('Id')) columnType = 'UUID';
                else if (column === 'status') columnType = 'VARCHAR(50)';
                else if (column === 'capacity') columnType = 'INTEGER';
                else if (column.includes('At')) columnType = 'TIMESTAMP';
                else if (column.includes('isActive') || column.includes('isEnabled')) columnType = 'BOOLEAN';

                migrationStatements.push(`
-- Fix missing column ${column} in ${tenant}.${table}
ALTER TABLE "${tenant}"."${table}" 
ADD COLUMN IF NOT EXISTS "${this.camelToSnake(column)}" ${columnType};
                `);
            }
        }

        if (migrationStatements.length > 0) {
            const migrationContent = `
-- ============================================================================
-- AUTO-GENERATED MIGRATION: Database Schema Fixes
-- Generated on: ${new Date().toISOString()}
-- ============================================================================

BEGIN;

${migrationStatements.join('\n')}

COMMIT;

-- ============================================================================
-- END OF AUTO-GENERATED MIGRATION
-- ============================================================================
            `;

            console.log('\n📝 GENERATED MIGRATION:');
            console.log(migrationContent);
            
            return migrationContent;
        } else {
            this.log('INFO', 'No migration fixes needed');
            return null;
        }
    }

    camelToSnake(str) {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }
}

// Main execution
async function runValidation() {
    const validator = new DatabaseModelValidator();
    
    console.log('🚀 Starting database vs model validation...');
    
    try {
        await validator.validateAllTenants();
        
        // Generate migration fixes if needed
        await validator.generateMigrationFixes();
        
    } catch (error) {
        console.error('🚨 Validation failed with error:', error);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = DatabaseModelValidator;

// Run if called directly
if (require.main === module) {
    runValidation();
}
