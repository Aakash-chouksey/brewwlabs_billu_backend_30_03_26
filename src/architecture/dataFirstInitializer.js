/**
 * DATA-FIRST INITIALIZER - Master Integration Module
 * 
 * Orchestrates all data-first enforcement systems at startup
 * Schema Guard + Migration Discipline + Version Enforcement + Safety
 */

const SchemaGuard = require('./schemaGuard');
const MigrationDiscipline = require('./migrationDiscipline');
const { SchemaVersionEnforcer, MIN_SUPPORTED_SCHEMA_VERSION } = require('./schemaVersionEnforcer');
const MigrationSafety = require('./migrationSafety');
const CachedFieldsValidator = require('./cachedFieldsValidator');
const PreDeploymentValidator = require('./preDeploymentValidator');

class DataFirstInitializer {
    constructor(controlPlaneSequelize, options = {}) {
        this.sequelize = controlPlaneSequelize;
        this.options = {
            strictMode: options.strictMode || process.env.DATA_FIRST_STRICT === 'true' || process.env.STRICT_SCHEMA_MODE === 'true',
            skipSchemaGuard: options.skipSchemaGuard || false,
            skipMigrationDiscipline: options.skipMigrationDiscipline || false,
            skipVersionCheck: options.skipVersionCheck || false,
            enableCachedFieldValidation: options.enableCachedFieldValidation || false,
            validateAllTenants: options.validateAllTenants !== false, // Default true
            ...options
        };

        // Initialize subsystems
        this.schemaGuard = new SchemaGuard(controlPlaneSequelize);
        this.migrationDiscipline = new MigrationDiscipline(controlPlaneSequelize);
        this.versionEnforcer = new SchemaVersionEnforcer(controlPlaneSequelize);
        this.migrationSafety = new MigrationSafety(controlPlaneSequelize);
        this.cachedFieldsValidator = new CachedFieldsValidator(controlPlaneSequelize);
        this.preDeployValidator = new PreDeploymentValidator(controlPlaneSequelize);

        this.initializationResults = {};
        this.blockers = [];
    }

    /**
     * Main initialization entry point
     */
    async initialize() {
        console.log('\n🏗️  [DataFirst] Initializing Data-First Architecture...');
        console.log(`   Strict Mode: ${this.options.strictMode}`);
        console.log(`   Min Schema Version: ${MIN_SUPPORTED_SCHEMA_VERSION}\n`);

        // Phase 1: Pre-flight checks
        await this._phase1_preflight();

        // Phase 2: Control Plane Validation
        await this._phase2_controlPlane();

        // Phase 3: Migration Safety Setup
        await this._phase3_migrationSafety();

        // Phase 4: Schema Discipline
        await this._phase4_migrationDiscipline();

        // Phase 5: Version Enforcement
        await this._phase5_versionEnforcement();

        // Phase 6: Optional validations
        if (this.options.enableCachedFieldValidation) {
            await this._phase6_cachedFields();
        }

        // Phase 7: Validate all tenant schemas (Schema Guard for tenants)
        if (this.options.validateAllTenants) {
            await this._phase7_tenantSchemaGuard();
        }

        // Final enforcement
        if (this.blockers.length > 0) {
            this._enforceBlockers();
        }

        console.log('\n✅ [DataFirst] Initialization Complete');
        return {
            success: true,
            blockers: this.blockers.length,
            results: this.initializationResults,
            status: 'data_first_ready'
        };
    }

    /**
     * Phase 1: Pre-flight database connectivity and permissions
     */
    async _phase1_preflight() {
        console.log('🔍 [DataFirst] Phase 1: Pre-flight checks...');

        try {
            // Test connection
            await this.sequelize.authenticate();
            console.log('   ✓ Database connection verified');

            // Check permissions
            const [result] = await this.sequelize.query('SELECT current_user, current_database()');
            console.log(`   ✓ Connected as: ${result[0].current_user}`);
            
            // Check if this is initial setup (no control plane tables yet)
            try {
                const [tables] = await this.sequelize.query(`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name IN ('businesses', 'users', 'tenant_registry')
                `);
                this.isInitialSetup = tables.length === 0;
                if (this.isInitialSetup) {
                    console.log('   ℹ️ Initial setup detected - control plane tables not yet created');
                }
            } catch (e) {
                this.isInitialSetup = true;
            }

            this.initializationResults.preflight = { passed: true, isInitialSetup: this.isInitialSetup };

        } catch (error) {
            this.blockers.push({
                phase: 'preflight',
                message: `Database connection failed: ${error.message}`
            });
            this.initializationResults.preflight = { passed: false, error: error.message };
        }
    }

    /**
     * Phase 2: Control Plane Schema Guard
     */
    async _phase2_controlPlane() {
        if (this.options.skipSchemaGuard || this.isInitialSetup) {
            if (this.isInitialSetup) {
                console.log('⏭️  [DataFirst] Phase 2: Schema Guard skipped (initial setup)');
            } else {
                console.log('⏭️  [DataFirst] Phase 2: Schema Guard skipped');
            }
            return;
        }

        console.log('🔍 [DataFirst] Phase 2: Control Plane Schema Validation...');

        try {
            const result = await this.schemaGuard.validate('public');
            this.initializationResults.schemaGuard = result;

            if (!result.passed) {
                const critical = result.mismatches.filter(m => m.severity === 'CRITICAL');
                if (critical.length > 0) {
                    this.blockers.push({
                        phase: 'schema_guard',
                        message: `${critical.length} critical schema mismatches in control plane`,
                        details: critical
                    });
                }
            }

            console.log(`   ✓ Validated ${result.modelsChecked} models`);
            if (result.mismatches.length > 0) {
                console.log(`   ⚠ ${result.mismatches.length} mismatches found`);
            }

        } catch (error) {
            this.blockers.push({
                phase: 'schema_guard',
                message: `Schema Guard failed: ${error.message}`
            });
            this.initializationResults.schemaGuard = { error: error.message };
        }
    }

    /**
     * Phase 3: Initialize Migration Safety Infrastructure
     */
    async _phase3_migrationSafety() {
        console.log('🔍 [DataFirst] Phase 3: Migration Safety Setup...');

        try {
            await this.migrationSafety.initialize();
            const health = await this.migrationSafety.healthCheck();
            
            this.initializationResults.migrationSafety = health;
            console.log(`   ✓ Migration safety initialized`);
            
            if (health.stuckLocks > 0) {
                console.warn(`   ⚠ ${health.stuckLocks} stuck migration locks detected`);
            }

        } catch (error) {
            console.warn(`   ⚠ Migration safety init warning: ${error.message}`);
            this.initializationResults.migrationSafety = { warning: error.message };
        }
    }

    /**
     * Phase 4: Migration Discipline
     */
    async _phase4_migrationDiscipline() {
        if (this.options.skipMigrationDiscipline) {
            console.log('⏭️  [DataFirst] Phase 4: Migration Discipline skipped');
            return;
        }

        console.log('🔍 [DataFirst] Phase 4: Migration Discipline...');

        try {
            const result = await this.migrationDiscipline.enforce();
            this.initializationResults.migrationDiscipline = result;
            console.log(`   ✓ Migration discipline enforced`);

        } catch (error) {
            this.blockers.push({
                phase: 'migration_discipline',
                message: `Migration discipline violation: ${error.message}`
            });
            this.initializationResults.migrationDiscipline = { error: error.message };
        }
    }

    /**
     * Phase 5: Schema Version Enforcement
     */
    async _phase5_versionEnforcement() {
        if (this.options.skipVersionCheck || this.isInitialSetup) {
            if (this.isInitialSetup) {
                console.log('⏭️  [DataFirst] Phase 5: Version Check skipped (initial setup)');
            } else {
                console.log('⏭️  [DataFirst] Phase 5: Version Check skipped');
            }
            return;
        }

        console.log('🔍 [DataFirst] Phase 5: Schema Version Enforcement...');

        try {
            // Get all tenant schemas
            const [tenants] = await this.sequelize.query(`
                SELECT schema_name, status 
                FROM tenant_registry 
                WHERE status = 'active'
            `);

            const validations = await Promise.all(
                tenants.map(async (t) => {
                    const result = await this.versionEnforcer.validateTenant(t.schema_name);
                    return { schema: t.schema_name, ...result };
                })
            );

            const outdated = validations.filter(v => !v.valid);
            
            this.initializationResults.versionEnforcement = {
                total: validations.length,
                valid: validations.filter(v => v.valid).length,
                invalid: outdated.length,
                details: outdated
            };

            console.log(`   ✓ Validated ${validations.length} tenant schemas`);
            
            if (outdated.length > 0) {
                console.warn(`   ⚠ ${outdated.length} tenants below min version ${MIN_SUPPORTED_SCHEMA_VERSION}`);
                if (this.options.strictMode) {
                    this.blockers.push({
                        phase: 'version_enforcement',
                        message: `${outdated.length} tenants require migration`,
                        tenants: outdated.map(t => t.schema)
                    });
                }
            }

        } catch (error) {
            console.warn(`   ⚠ Version enforcement warning: ${error.message}`);
            this.initializationResults.versionEnforcement = { warning: error.message };
        }
    }

    /**
     * Phase 6: Cached Fields Validation
     */
    async _phase6_cachedFields() {
        if (this.isInitialSetup) {
            console.log('⏭️  [DataFirst] Phase 6: Cached Fields Validation skipped (initial setup)');
            return;
        }
        
        console.log('🔍 [DataFirst] Phase 6: Cached Fields Validation...');

        try {
            // Validate on a sample tenant (not all for performance)
            const [sampleTenant] = await this.sequelize.query(`
                SELECT schema_name FROM tenant_registry 
                WHERE status = 'active' 
                LIMIT 1
            `);

            if (sampleTenant && sampleTenant.length > 0) {
                const result = await this.cachedFieldsValidator.validate(sampleTenant[0].schema_name);
                this.initializationResults.cachedFields = result;
                
                console.log(`   ✓ Validated cached fields on ${sampleTenant[0].schema_name}`);
                if (result.invalid > 0) {
                    console.warn(`   ⚠ ${result.invalid} cached field inconsistencies found`);
                }
            }

        } catch (error) {
            console.warn(`   ⚠ Cached fields validation warning: ${error.message}`);
        }
    }

    /**
     * Phase 7: Schema Guard for all Tenant Schemas
     * Validates that all tenant schemas match their model definitions
     */
    async _phase7_tenantSchemaGuard() {
        if (this.options.skipSchemaGuard || this.isInitialSetup) {
            if (this.isInitialSetup) {
                console.log('⏭️  [DataFirst] Phase 7: Tenant Schema Guard skipped (initial setup)');
            } else {
                console.log('⏭️  [DataFirst] Phase 7: Tenant Schema Guard skipped');
            }
            return;
        }

        console.log('🔍 [DataFirst] Phase 7: Validating all tenant schemas...');

        try {
            // Get all active tenant schemas
            const [tenants] = await this.sequelize.query(`
                SELECT schema_name, status 
                FROM tenant_registry 
                WHERE status = 'active'
            `);

            if (!tenants || tenants.length === 0) {
                console.log('   ℹ️ No active tenants to validate');
                this.initializationResults.tenantSchemaGuard = { validated: 0, passed: 0, failed: 0 };
                return;
            }

            console.log(`   🔍 Schema Guard validating ${tenants.length} tenant schemas...`);

            const results = {
                validated: 0,
                passed: 0,
                failed: 0,
                mismatches: [],
                details: []
            };

            // Validate each tenant schema
            for (const tenant of tenants) {
                const schemaName = tenant.schema_name;
                try {
                    // Import unified database to get models bound to tenant schema
                    const { sequelize } = require('../../config/unified_database');
                    const tenantModelLoader = require('./tenantModelLoader');
                    
                    // Ensure models are bound to this schema
                    await tenantModelLoader.getTenantModels(sequelize, schemaName);

                    // Run Schema Guard validation
                    const validation = await this.schemaGuard.validateTenant(schemaName);
                    
                    results.validated++;
                    
                    if (validation.passed) {
                        results.passed++;
                        console.log(`   ✅ ${schemaName}: Schema valid`);
                    } else {
                        results.failed++;
                        const issue = {
                            schema: schemaName,
                            critical: validation.mismatches.filter(m => m.severity === 'CRITICAL').length,
                            warnings: validation.warnings.length,
                            newFields: validation.newFieldsWithoutMigration,
                            removedFields: validation.removedFieldsStillInDb
                        };
                        results.mismatches.push(issue);
                        console.log(`   ❌ ${schemaName}: ${issue.critical} critical, ${issue.warnings} warnings`);
                    }

                    results.details.push({
                        schema: schemaName,
                        ...validation
                    });

                } catch (error) {
                    results.failed++;
                    results.mismatches.push({
                        schema: schemaName,
                        error: error.message
                    });
                    console.error(`   ❌ ${schemaName}: Validation error - ${error.message}`);
                }
            }

            this.initializationResults.tenantSchemaGuard = results;

            console.log(`   ✓ Validated ${results.validated} tenant schemas`);
            console.log(`   ✅ Passed: ${results.passed}`);
            if (results.failed > 0) {
                console.log(`   ❌ Failed: ${results.failed}`);
            }

            // In strict mode, block if any tenant schema has issues
            if (this.options.strictMode && results.failed > 0) {
                this.blockers.push({
                    phase: 'tenant_schema_guard',
                    message: `${results.failed} tenant schemas have mismatches`,
                    details: results.mismatches
                });
            }

        } catch (error) {
            console.error(`   ❌ Tenant Schema Guard error: ${error.message}`);
            this.initializationResults.tenantSchemaGuard = { error: error.message };
            
            if (this.options.strictMode) {
                this.blockers.push({
                    phase: 'tenant_schema_guard',
                    message: `Tenant schema validation failed: ${error.message}`
                });
            }
        }
    }

    /**
     * Enforce blockers based on strict mode
     */
    _enforceBlockers() {
        const message = `
╔════════════════════════════════════════════════════════════╗
║  🚨 DATA-FIRST INITIALIZATION BLOCKED 🚨                   ║
╠════════════════════════════════════════════════════════════╣
${this.blockers.map(b => `║  [${b.phase.toUpperCase()}] ${b.message.substring(0, 45).padEnd(45)}║`).join('\n')}
╠════════════════════════════════════════════════════════════╣
║  Resolution:                                               ║
║  1. Run pending migrations: npm run migrate                  ║
║  2. Fix schema mismatches in model definitions               ║
║  3. Set DATA_FIRST_LENIENT=true to skip (NOT recommended)  ║
╚════════════════════════════════════════════════════════════╝
        `;

        if (this.options.strictMode || process.env.DATA_FIRST_LENIENT !== 'true') {
            console.error(message);
            throw new Error(`[DataFirst] ${this.blockers.length} blockers preventing startup`);
        } else {
            console.warn(message);
            console.warn('⚠️  Proceeding despite blockers (DATA_FIRST_LENIENT=true)');
        }
    }

    /**
     * Run pre-deployment validation
     */
    async runPreDeployValidation() {
        return await this.preDeployValidator.validate();
    }

    /**
     * Get comprehensive status
     */
    async getStatus() {
        return {
            dataFirstEnabled: true,
            strictMode: this.options.strictMode,
            minSchemaVersion: MIN_SUPPORTED_SCHEMA_VERSION,
            blockers: this.blockers.length,
            initializationResults: this.initializationResults,
            versionEnforcerStatus: this.versionEnforcer.getStatus(),
            migrationStatus: await this.migrationSafety.getStatus()
        };
    }

    /**
     * Express middleware for runtime tenant validation
     */
    tenantValidationMiddleware() {
        return async (req, res, next) => {
            const tenantSchema = req.tenantSchema || req.schema;
            
            if (!tenantSchema) {
                return next();
            }

            try {
                const validation = await this.versionEnforcer.validateTenant(tenantSchema);
                
                if (!validation.valid) {
                    return res.status(503).json({
                        success: false,
                        error: 'SCHEMA_VERSION_UNSUPPORTED',
                        message: validation.message,
                        action: 'MIGRATION_REQUIRED'
                    });
                }

                req.schemaVersion = validation.version;
                next();
            } catch (error) {
                next(error);
            }
        };
    }

    /**
     * Health check endpoint
     */
    async healthCheck() {
        const checks = {
            schemaGuard: await this.schemaGuard.healthCheck(),
            versionEnforcer: await this.versionEnforcer.healthCheck(),
            migrationSafety: await this.migrationSafety.healthCheck()
        };

        const healthy = Object.values(checks).every(c => 
            c.status === 'healthy' || c.status === 'ok'
        );

        return {
            status: healthy ? 'healthy' : 'degraded',
            checks
        };
    }
}

// Singleton management
let globalInstance = null;

module.exports = {
    DataFirstInitializer,
    
    // Factory function
    initialize: async (sequelize, options = {}) => {
        const initializer = new DataFirstInitializer(sequelize, options);
        globalInstance = initializer;
        return await initializer.initialize();
    },
    
    // Get singleton instance
    getInstance: () => globalInstance,
    
    // Direct access to subsystems
    SchemaGuard,
    MigrationDiscipline,
    SchemaVersionEnforcer,
    MigrationSafety,
    CachedFieldsValidator,
    PreDeploymentValidator
};
