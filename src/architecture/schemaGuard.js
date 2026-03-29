/**
 * SCHEMA GUARD - Data-First Architecture Enforcer
 * 
 * Compares Sequelize models vs actual database schema at startup
 * Blocks/warns on mismatch based on environment
 */

const { Sequelize } = require('sequelize');
const config = require('../../config/config');

class SchemaGuard {
    constructor(sequelize) {
        this.sequelize = sequelize;
        this.mismatches = [];
        this.warnings = [];
        this.isDev = config.nodeEnv === 'development';
        this.isProduction = config.nodeEnv === 'production';
        this.strictMode = process.env.STRICT_SCHEMA_MODE === 'true';
    }

    /**
     * Main validation entry point
     * @returns {Promise<Object>} Validation result
     */
    async validate(schema = null) {
        console.log('🔍 [SchemaGuard] Starting schema validation...');
        
        const targetSchema = schema || 'public';
        const models = this.sequelize.models;
        
        if (!models || Object.keys(models).length === 0) {
            throw new Error('[SchemaGuard] No models found in sequelize instance');
        }

        // Get actual DB schema
        const dbSchema = await this._fetchDatabaseSchema(targetSchema);
        
        // Compare each model
        for (const [modelName, model] of Object.entries(models)) {
            await this._validateModel(modelName, model, dbSchema);
        }

        const result = {
            passed: this.strictMode 
                ? (this.mismatches.length === 0 && this.warnings.length === 0)
                : this.mismatches.length === 0,
            strictMode: this.strictMode,
            mismatches: this.mismatches,
            warnings: this.warnings,
            modelsChecked: Object.keys(models).length,
            newFieldsWithoutMigration: this.mismatches.filter(m => m.type === 'MISSING_COLUMN').length,
            removedFieldsStillInDb: this.warnings.filter(w => w.type === 'EXTRA_COLUMN').length,
            timestamp: new Date().toISOString()
        };

        // Enforce based on environment
        if (!result.passed) {
            this._enforceMismatch(result);
        }

        console.log(`✅ [SchemaGuard] Validation complete. Models: ${result.modelsChecked}, Mismatches: ${result.mismatches.length}`);
        return result;
    }

    /**
     * Fetch actual database schema from information_schema
     */
    async _fetchDatabaseSchema(schemaName) {
        const query = `
            SELECT 
                table_name,
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length,
                numeric_precision,
                numeric_scale
            FROM information_schema.columns
            WHERE table_schema = :schema
            ORDER BY table_name, ordinal_position
        `;

        const [rows] = await this.sequelize.query(query, {
            replacements: { schema: schemaName },
            type: Sequelize.QueryTypes.SELECT
        });

        // Organize by table
        const schema = {};
        for (const row of rows) {
            const tableName = row.table_name;
            if (!schema[tableName]) {
                schema[tableName] = {};
            }
            schema[tableName][row.column_name] = {
                type: row.data_type,
                nullable: row.is_nullable === 'YES',
                default: row.column_default,
                maxLength: row.character_maximum_length,
                precision: row.numeric_precision,
                scale: row.numeric_scale
            };
        }

        return schema;
    }

    /**
     * Validate a single model against DB schema
     */
    async _validateModel(modelName, model, dbSchema) {
        const tableName = model.getTableName();
        const attributes = model.rawAttributes;
        const dbTable = dbSchema[tableName];

        if (!dbTable) {
            this.mismatches.push({
                type: 'MISSING_TABLE',
                model: modelName,
                table: tableName,
                severity: 'CRITICAL',
                message: `Table '${tableName}' does not exist in database`
            });
            return;
        }

        // Check each model attribute exists in DB
        for (const [attrName, attrDef] of Object.entries(attributes)) {
            const dbColumnName = attrDef.field || attrName;
            const dbColumn = dbTable[dbColumnName];

            if (!dbColumn) {
                this.mismatches.push({
                    type: 'MISSING_COLUMN',
                    model: modelName,
                    table: tableName,
                    column: dbColumnName,
                    attribute: attrName,
                    severity: 'CRITICAL',
                    message: `Column '${dbColumnName}' missing in table '${tableName}'`
                });
                continue;
            }

            // Type compatibility check
            const typeMatch = this._checkTypeCompatibility(attrDef.type, dbColumn.type);
            if (!typeMatch.compatible) {
                this.mismatches.push({
                    type: 'TYPE_MISMATCH',
                    model: modelName,
                    table: tableName,
                    column: dbColumnName,
                    expected: typeMatch.expected,
                    actual: dbColumn.type,
                    severity: 'WARNING',
                    message: `Type mismatch: expected ${typeMatch.expected}, found ${dbColumn.type}`
                });
            }

            // Nullability check
            const modelNullable = attrDef.allowNull !== false;
            if (modelNullable !== dbColumn.nullable) {
                this.warnings.push({
                    type: 'NULLABLE_MISMATCH',
                    model: modelName,
                    table: tableName,
                    column: dbColumnName,
                    modelNullable,
                    dbNullable: dbColumn.nullable,
                    severity: 'WARNING'
                });
            }
        }

        // Check for extra columns in DB not in model
        for (const dbColumnName of Object.keys(dbTable)) {
            const existsInModel = Object.entries(attributes).some(
                ([_, attr]) => (attr.field || _) === dbColumnName
            );
            
            if (!existsInModel) {
                this.warnings.push({
                    type: 'EXTRA_COLUMN',
                    model: modelName,
                    table: tableName,
                    column: dbColumnName,
                    severity: 'INFO',
                    message: `Extra column '${dbColumnName}' in DB not defined in model`
                });
            }
        }
    }

    /**
     * Check if Sequelize type is compatible with DB type
     */
    _checkTypeCompatibility(sequelizeType, dbType) {
        const typeMap = {
            'STRING': ['character varying', 'varchar', 'text', 'char'],
            'TEXT': ['text', 'character varying'],
            'INTEGER': ['integer', 'bigint', 'smallint'],
            'BIGINT': ['bigint', 'integer'],
            'DECIMAL': ['numeric', 'decimal', 'real', 'double precision'],
            'FLOAT': ['real', 'double precision', 'numeric'],
            'BOOLEAN': ['boolean'],
            'DATE': ['timestamp without time zone', 'timestamp with time zone', 'date'],
            'DATEONLY': ['date'],
            'JSON': ['json', 'jsonb'],
            'JSONB': ['jsonb', 'json'],
            'UUID': ['uuid'],
            'ENUM': ['enum', 'character varying']
        };

        const typeKey = sequelizeType?.key || sequelizeType?.toString();
        const compatibleTypes = typeMap[typeKey] || [];
        
        const normalizedDbType = dbType.toLowerCase();
        const compatible = compatibleTypes.some(t => normalizedDbType.includes(t));

        return {
            compatible,
            expected: typeKey,
            actual: dbType
        };
    }

    /**
     * Enforce mismatch based on environment and STRICT_SCHEMA_MODE
     */
    _enforceMismatch(result) {
        const criticalCount = result.mismatches.filter(m => m.severity === 'CRITICAL').length;
        const warningCount = result.mismatches.filter(m => m.severity === 'WARNING').length;
        const totalIssues = criticalCount + warningCount;
        
        if (totalIssues === 0) return;

        const errorMessage = `
🚨 SCHEMA MISMATCH DETECTED 🚨

Issues found: ${totalIssues} (Critical: ${criticalCount}, Warnings: ${warningCount})
${result.mismatches.map(m => `  - [${m.type}] ${m.table}.${m.column || ''}: ${m.message}`).join('\n')}
${result.warnings.map(w => `  - [${w.type}] ${w.table}.${w.column || ''}: ${w.message}`).join('\n')}

[DATA-FIRST ENFORCEMENT]
Environment: ${this.isDev ? 'Development' : 'Production'}
STRICT_SCHEMA_MODE: ${this.strictMode ? 'ENABLED' : 'DISABLED'}
Action: ${this.strictMode || this.isProduction ? 'BLOCKING STARTUP' : 'WARNING ONLY'}

Resolution:
1. Run migrations: npm run migrate
2. Check model definitions match migrations
3. Verify database connection
4. Set STRICT_SCHEMA_MODE=false to allow startup (NOT recommended)
            `;

        // STRICT MODE: Block on ANY mismatch (critical or warning)
        if (this.strictMode) {
            console.error(errorMessage);
            throw new Error(`[SchemaGuard] STRICT_SCHEMA_MODE enabled: ${totalIssues} schema issues blocking startup.`);
        }

        // Production: Block on critical mismatches only
        if (this.isProduction && criticalCount > 0) {
            console.error(errorMessage);
            throw new Error(`[SchemaGuard] Production mode: ${criticalCount} critical schema mismatches blocking startup.`);
        }

        // Development: Warn only
        console.warn(errorMessage);
    }

    /**
     * Validate a specific tenant schema
     */
    async validateTenant(tenantSchema) {
        console.log(`🔍 [SchemaGuard] Validating tenant schema: ${tenantSchema}`);
        return this.validate(tenantSchema);
    }

    /**
     * Health check endpoint
     */
    async healthCheck() {
        try {
            const result = await this.validate();
            return {
                status: result.passed ? 'healthy' : 'degraded',
                ...result
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = SchemaGuard;
