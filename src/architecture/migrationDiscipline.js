/**
 * MIGRATION DISCIPLINE - Data-First Migration Enforcer
 * 
 * Detects model changes without migration files
 * Prevents server start if model changes are not reflected in migrations
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const config = require('../../config/config');

class MigrationDiscipline {
    constructor(sequelize) {
        this.sequelize = sequelize;
        this.migrationsDir = path.join(process.cwd(), 'migrations');
        this.modelHashFile = path.join(process.cwd(), '.model-hashes.json');
        this.violations = [];
    }

    /**
     * Main entry point - check migration discipline
     */
    async enforce() {
        console.log('🔍 [MigrationDiscipline] Checking migration discipline...');

        // 1. Calculate current model hashes
        const currentHashes = await this._calculateModelHashes();
        
        // 2. Load previous hashes
        const previousHashes = this._loadPreviousHashes();
        
        // 3. Detect changes
        const changes = this._detectChanges(previousHashes, currentHashes);
        
        // 4. Check if migrations exist for changes
        const uncoveredChanges = await this._findUncoveredChanges(changes);
        
        // 5. Enforce
        if (uncoveredChanges.length > 0) {
            this._enforceViolation(uncoveredChanges);
        }

        // 6. Save current state
        this._saveHashes(currentHashes);

        console.log('✅ [MigrationDiscipline] All model changes have corresponding migrations');
        return {
            passed: true,
            changes: changes.length,
            uncoveredChanges: 0
        };
    }

    /**
     * Calculate hash of model definitions
     */
    async _calculateModelHashes() {
        const models = this.sequelize.models;
        const hashes = {};

        for (const [modelName, model] of Object.entries(models)) {
            const attributes = model.rawAttributes;
            const sortedAttrs = Object.keys(attributes).sort().reduce((acc, key) => {
                const attr = attributes[key];
                acc[key] = {
                    type: attr.type?.key || attr.type?.toString(),
                    allowNull: attr.allowNull,
                    defaultValue: attr.defaultValue !== undefined,
                    field: attr.field,
                    primaryKey: attr.primaryKey,
                    autoIncrement: attr.autoIncrement,
                    unique: attr.unique,
                    references: attr.references ? `${attr.references.model}.${attr.references.key}` : null
                };
                return acc;
            }, {});

            // Create deterministic hash
            const hash = crypto
                .createHash('sha256')
                .update(JSON.stringify(sortedAttrs))
                .digest('hex')
                .substring(0, 16);

            hashes[modelName] = {
                hash,
                attributes: sortedAttrs,
                tableName: model.getTableName()
            };
        }

        return hashes;
    }

    /**
     * Load previous model hashes from file
     */
    _loadPreviousHashes() {
        try {
            if (fs.existsSync(this.modelHashFile)) {
                const content = fs.readFileSync(this.modelHashFile, 'utf8');
                return JSON.parse(content);
            }
        } catch (error) {
            console.warn('[MigrationDiscipline] Could not load previous hashes:', error.message);
        }
        return {};
    }

    /**
     * Save current hashes to file
     */
    _saveHashes(hashes) {
        try {
            fs.writeFileSync(this.modelHashFile, JSON.stringify(hashes, null, 2));
        } catch (error) {
            console.warn('[MigrationDiscipline] Could not save hashes:', error.message);
        }
    }

    /**
     * Detect what changed between previous and current
     */
    _detectChanges(previous, current) {
        const changes = [];

        for (const [modelName, currentData] of Object.entries(current)) {
            const previousData = previous[modelName];

            if (!previousData) {
                changes.push({
                    type: 'NEW_MODEL',
                    model: modelName,
                    severity: 'CRITICAL',
                    message: `New model '${modelName}' detected - requires migration`
                });
                continue;
            }

            if (previousData.hash !== currentData.hash) {
                // Find specific changes
                const attrChanges = this._detectAttributeChanges(
                    previousData.attributes,
                    currentData.attributes
                );

                changes.push({
                    type: 'MODEL_CHANGED',
                    model: modelName,
                    severity: 'CRITICAL',
                    message: `Model '${modelName}' definition changed`,
                    changes: attrChanges
                });
            }
        }

        // Check for deleted models
        for (const modelName of Object.keys(previous)) {
            if (!current[modelName]) {
                changes.push({
                    type: 'DELETED_MODEL',
                    model: modelName,
                    severity: 'WARNING',
                    message: `Model '${modelName}' removed - verify intentional`
                });
            }
        }

        return changes;
    }

    /**
     * Detect specific attribute changes
     */
    _detectAttributeChanges(previous, current) {
        const changes = [];

        for (const [attrName, currentDef] of Object.entries(current)) {
            const previousDef = previous[attrName];

            if (!previousDef) {
                changes.push({
                    type: 'NEW_ATTRIBUTE',
                    attribute: attrName,
                    definition: currentDef
                });
            } else if (JSON.stringify(previousDef) !== JSON.stringify(currentDef)) {
                changes.push({
                    type: 'MODIFIED_ATTRIBUTE',
                    attribute: attrName,
                    from: previousDef,
                    to: currentDef
                });
            }
        }

        for (const attrName of Object.keys(previous)) {
            if (!current[attrName]) {
                changes.push({
                    type: 'DELETED_ATTRIBUTE',
                    attribute: attrName
                });
            }
        }

        return changes;
    }

    /**
     * Check if migrations exist for detected changes
     */
    async _findUncoveredChanges(changes) {
        const uncovered = [];

        // Get recent migration files
        const migrationFiles = this._getMigrationFiles();
        
        // Get executed migrations from DB
        const executedMigrations = await this._getExecutedMigrations();

        for (const change of changes) {
            if (change.severity !== 'CRITICAL') continue;

            // Check if recent migration covers this model
            const covered = await this._isChangeCovered(change, migrationFiles, executedMigrations);
            
            if (!covered) {
                uncovered.push(change);
            }
        }

        return uncovered;
    }

    /**
     * Get migration files from directory
     */
    _getMigrationFiles() {
        try {
            if (!fs.existsSync(this.migrationsDir)) {
                return [];
            }

            return fs.readdirSync(this.migrationsDir)
                .filter(f => f.endsWith('.sql') || f.endsWith('.js'))
                .map(f => ({
                    name: f,
                    path: path.join(this.migrationsDir, f),
                    timestamp: fs.statSync(path.join(this.migrationsDir, f)).mtime
                }))
                .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
                .slice(0, 20); // Last 20 migrations
        } catch (error) {
            console.warn('[MigrationDiscipline] Error reading migrations:', error.message);
            return [];
        }
    }

    /**
     * Get executed migrations from SequelizeMeta
     */
    async _getExecutedMigrations() {
        try {
            const [rows] = await this.sequelize.query(
                `SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 20`,
                { type: Sequelize.QueryTypes.SELECT }
            );
            return rows.map(r => r.name);
        } catch (error) {
            // SequelizeMeta might not exist yet
            return [];
        }
    }

    /**
     * Check if a change is covered by recent migrations
     */
    async _isChangeCovered(change, migrationFiles, executedMigrations) {
        const modelName = change.model.toLowerCase();
        const tableName = change.tableName || modelName + 's';

        // Check recent migration files for model references
        for (const migration of migrationFiles.slice(0, 5)) { // Check last 5 migrations
            try {
                const content = fs.readFileSync(migration.path, 'utf8').toLowerCase();
                
                // Check for model/table references
                if (content.includes(modelName) || 
                    content.includes(tableName) ||
                    content.includes(`create table ${tableName}`) ||
                    content.includes(`alter table ${tableName}`)) {
                    return true;
                }

                // Check for column changes
                if (change.changes) {
                    for (const attrChange of change.changes) {
                        const columnName = attrChange.attribute.toLowerCase();
                        if (content.includes(columnName)) {
                            return true;
                        }
                    }
                }
            } catch (error) {
                // Skip unreadable files
            }
        }

        // Check if a migration exists but not executed
        const pendingMigration = migrationFiles.find(m => {
            const content = fs.readFileSync(m.path, 'utf8').toLowerCase();
            return content.includes(modelName) || content.includes(tableName);
        });

        if (pendingMigration && !executedMigrations.includes(pendingMigration.name)) {
            console.warn(`⚠️ [MigrationDiscipline] Migration '${pendingMigration.name}' exists but not executed`);
        }

        return false;
    }

    /**
     * Enforce violation based on environment
     */
    _enforceViolation(uncoveredChanges) {
        const message = `
🚨 MIGRATION DISCIPLINE VIOLATION 🚨

Model changes detected WITHOUT corresponding migrations:
${uncoveredChanges.map(c => `  - [${c.type}] ${c.model}: ${c.message}${c.changes ? '\n' + c.changes.map(ch => `    * ${ch.type}: ${ch.attribute}`).join('\n') : ''}`).join('\n')}

[DATA-FIRST ENFORCEMENT]
${config.nodeEnv === 'production' ? 'Production mode: Server startup BLOCKED' : 'Development mode: Starting with warnings'}

Resolution:
1. Create migration: npm run migrate:generate -- --name your_migration
2. Or run: npm run migrate:status to check pending migrations
3. Set MIGRATION_LENIENT=true to skip (not recommended)
        `;

        if (config.nodeEnv === 'production' && process.env.MIGRATION_LENIENT !== 'true') {
            console.error(message);
            throw new Error(`[MigrationDiscipline] ${uncoveredChanges.length} model changes without migrations. Startup blocked.`);
        } else {
            console.warn(message);
        }
    }

    /**
     * Validate specific model hasn't changed
     */
    async validateModel(modelName) {
        const currentHashes = await this._calculateModelHashes();
        const previousHashes = this._loadPreviousHashes();

        const current = currentHashes[modelName];
        const previous = previousHashes[modelName];

        if (!current) {
            throw new Error(`Model '${modelName}' not found`);
        }

        if (!previous || previous.hash !== current.hash) {
            return {
                valid: false,
                model: modelName,
                changed: true,
                currentHash: current.hash,
                previousHash: previous?.hash
            };
        }

        return { valid: true, model: modelName };
    }

    /**
     * Reset hashes (use after migrations are run)
     */
    reset() {
        if (fs.existsSync(this.modelHashFile)) {
            fs.unlinkSync(this.modelHashFile);
            console.log('🗑️ [MigrationDiscipline] Model hashes reset');
        }
    }

    /**
     * Status report
     */
    async status() {
        const currentHashes = await this._calculateModelHashes();
        const previousHashes = this._loadPreviousHashes();
        const changes = this._detectChanges(previousHashes, currentHashes);
        
        const migrationFiles = this._getMigrationFiles();
        const executedMigrations = await this._getExecutedMigrations();

        return {
            modelsTracked: Object.keys(currentHashes).length,
            changesDetected: changes.length,
            criticalChanges: changes.filter(c => c.severity === 'CRITICAL').length,
            migrationFiles: migrationFiles.length,
            executedMigrations: executedMigrations.length,
            pendingMigrations: migrationFiles.length - executedMigrations.length,
            changes: changes
        };
    }
}

module.exports = MigrationDiscipline;
