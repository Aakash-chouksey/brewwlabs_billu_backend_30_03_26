/**
 * PRE-DEPLOYMENT VALIDATOR - Deployment Safety Gate
 * 
 * Ensures all tenants are on latest schema before deployment
 * Fails deployment if mismatch found
 */

const { Sequelize } = require('sequelize');
const { SchemaVersionEnforcer } = require('./schemaVersionEnforcer');

class PreDeploymentValidator {
    constructor(controlPlaneSequelize) {
        this.sequelize = controlPlaneSequelize;
        this.schemaEnforcer = new SchemaVersionEnforcer(controlPlaneSequelize);
        this.checks = [];
        this.blockers = [];
        this.warnings = [];
    }

    /**
     * Run all pre-deployment validations
     */
    async validate(options = {}) {
        const {
            skipSchemaCheck = false,
            skipMigrationCheck = false,
            skipTenantCheck = false,
            targetVersion = null
        } = options;

        console.log('🔍 [PreDeploy] Starting pre-deployment validation...');
        
        this.checks = [];
        this.blockers = [];
        this.warnings = [];

        // 1. Check all tenants on latest schema
        if (!skipSchemaCheck) {
            await this._validateTenantSchemas(targetVersion);
        }

        // 2. Check no pending migrations
        if (!skipMigrationCheck) {
            await this._checkPendingMigrations();
        }

        // 3. Check tenant health
        if (!skipTenantCheck) {
            await this._validateTenantHealth();
        }

        // 4. Check control plane consistency
        await this._validateControlPlane();

        // 5. Check data integrity
        await this._validateDataIntegrity();

        // Compile report
        const report = {
            timestamp: new Date().toISOString(),
            passed: this.blockers.length === 0,
            checks: this.checks.length,
            blockers: this.blockers.length,
            warnings: this.warnings.length,
            canDeploy: this.blockers.length === 0,
            details: {
                checks: this.checks,
                blockers: this.blockers,
                warnings: this.warnings
            }
        };

        // Output result
        if (report.canDeploy) {
            console.log('✅ [PreDeploy] Validation PASSED - Ready for deployment');
        } else {
            console.error('❌ [PreDeploy] Validation FAILED - Deployment BLOCKED');
            console.error('Blockers:', this.blockers.map(b => `  - ${b.check}: ${b.message}`).join('\n'));
        }

        return report;
    }

    /**
     * Validate all tenant schemas are up to date
     */
    async _validateTenantSchemas(targetVersion) {
        this._addCheck('TENANT_SCHEMA_VERSION');

        try {
            // Get all active tenants
            const [tenants] = await this.sequelize.query(`
                SELECT schema_name, version, business_id
                FROM tenant_registries
                WHERE status = 'active'
            `);

            const minVersion = targetVersion || require('./schemaVersionEnforcer').MIN_SUPPORTED_SCHEMA_VERSION;
            const outdatedTenants = [];

            for (const tenant of tenants) {
                const validation = await this.schemaEnforcer.validateTenant(tenant.schema_name);
                
                if (!validation.valid) {
                    outdatedTenants.push({
                        schema: tenant.schema_name,
                        businessId: tenant.business_id,
                        currentVersion: validation.currentVersion,
                        requiredVersion: minVersion,
                        issue: validation.error
                    });
                }
            }

            if (outdatedTenants.length > 0) {
                this._addBlocker('TENANT_SCHEMA_VERSION', 
                    `${outdatedTenants.length} tenants on outdated schema`,
                    { outdatedTenants }
                );
            } else {
                this._addPass('TENANT_SCHEMA_VERSION', 
                    `All ${tenants.length} tenants on supported schema version`
                );
            }

        } catch (error) {
            this._addBlocker('TENANT_SCHEMA_VERSION', 
                `Failed to validate tenant schemas: ${error.message}`
            );
        }
    }

    /**
     * Check for pending migrations
     */
    async _checkPendingMigrations() {
        this._addCheck('PENDING_MIGRATIONS');

        try {
            // Get all migration files
            const fs = require('fs');
            const path = require('path');
            const migrationsDir = path.join(process.cwd(), 'migrations');
            
            if (!fs.existsSync(migrationsDir)) {
                this._addPass('PENDING_MIGRATIONS', 'No migrations directory');
                return;
            }

            const migrationFiles = fs.readdirSync(migrationsDir)
                .filter(f => f.endsWith('.sql') || f.endsWith('.js'))
                .sort();

            // Get executed migrations
            let executedMigrations = [];
            try {
                const [rows] = await this.sequelize.query(`
                    SELECT name FROM "SequelizeMeta" ORDER BY name
                `);
                executedMigrations = rows.map(r => r.name);
            } catch (e) {
                // SequelizeMeta might not exist
            }

            const pendingMigrations = migrationFiles.filter(f => !executedMigrations.includes(f));

            if (pendingMigrations.length > 0) {
                this._addBlocker('PENDING_MIGRATIONS',
                    `${pendingMigrations.length} pending migrations must be run before deployment`,
                    { pendingMigrations }
                );
            } else {
                this._addPass('PENDING_MIGRATIONS', 
                    `All ${migrationFiles.length} migrations executed`
                );
            }

        } catch (error) {
            this._addWarning('PENDING_MIGRATIONS',
                `Could not check migrations: ${error.message}`
            );
        }
    }

    /**
     * Validate tenant health
     */
    async _validateTenantHealth() {
        this._addCheck('TENANT_HEALTH');

        try {
            const [tenants] = await this.sequelize.query(`
                SELECT schema_name, status, error_count
                FROM tenant_registries
                WHERE status IN ('active', 'error')
            `);

            const unhealthyTenants = tenants.filter(t => 
                t.status === 'error' || (t.error_count && t.error_count > 10)
            );

            if (unhealthyTenants.length > 0) {
                this._addBlocker('TENANT_HEALTH',
                    `${unhealthyTenants.length} tenants in error state`,
                    { unhealthyTenants }
                );
            } else {
                this._addPass('TENANT_HEALTH',
                    `All ${tenants.length} tenants healthy`
                );
            }

        } catch (error) {
            this._addWarning('TENANT_HEALTH',
                `Could not check tenant health: ${error.message}`
            );
        }
    }

    /**
     * Validate control plane consistency
     */
    async _validateControlPlane() {
        this._addCheck('CONTROL_PLANE');

        try {
            // Check control plane tables exist
            const requiredTables = ['businesses', 'users', 'outlets', 'tenant_registries'];
            
            for (const table of requiredTables) {
                const [exists] = await this.sequelize.query(`
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = :table
                    ) as exists
                `, {
                    replacements: { table },
                    type: Sequelize.QueryTypes.SELECT
                });

                if (!exists || !exists.exists) {
                    this._addBlocker('CONTROL_PLANE',
                        `Required table '${table}' missing in control plane`
                    );
                    return;
                }
            }

            this._addPass('CONTROL_PLANE', 'All required control plane tables present');

        } catch (error) {
            this._addBlocker('CONTROL_PLANE',
                `Control plane validation failed: ${error.message}`
            );
        }
    }

    /**
     * Validate data integrity
     */
    async _validateDataIntegrity() {
        this._addCheck('DATA_INTEGRITY');

        const integrityChecks = [
            {
                name: 'Orphaned tenant records',
                query: `
                    SELECT COUNT(*) as count 
                    FROM tenant_registries tr
                    LEFT JOIN businesses b ON tr.business_id = b.id
                    WHERE b.id IS NULL
                `
            },
            {
                name: 'Users without business',
                query: `
                    SELECT COUNT(*) as count
                    FROM users u
                    LEFT JOIN businesses b ON u.business_id = b.id
                    WHERE u.business_id IS NOT NULL AND b.id IS NULL
                `
            },
            {
                name: 'Orphaned outlets',
                query: `
                    SELECT COUNT(*) as count
                    FROM outlets o
                    LEFT JOIN businesses b ON o.business_id = b.id
                    WHERE b.id IS NULL
                `
            }
        ];

        const issues = [];

        for (const check of integrityChecks) {
            try {
                const [result] = await this.sequelize.query(check.query);
                if (result.count > 0) {
                    issues.push(`${check.name}: ${result.count}`);
                }
            } catch (e) {
                // Table might not exist yet
            }
        }

        if (issues.length > 0) {
            this._addWarning('DATA_INTEGRITY',
                `Data integrity issues found: ${issues.join(', ')}`
            );
        } else {
            this._addPass('DATA_INTEGRITY', 'No data integrity issues');
        }
    }

    /**
     * Helper: Add check entry
     */
    _addCheck(name) {
        this.checks.push({ name, status: 'running', timestamp: new Date().toISOString() });
    }

    /**
     * Helper: Add passing check
     */
    _addPass(name, message) {
        const check = this.checks.find(c => c.name === name);
        if (check) {
            check.status = 'passed';
            check.message = message;
            check.completedAt = new Date().toISOString();
        }
    }

    /**
     * Helper: Add blocking issue
     */
    _addBlocker(check, message, details = null) {
        this.blockers.push({
            check,
            message,
            details,
            timestamp: new Date().toISOString()
        });
        
        const checkEntry = this.checks.find(c => c.name === check);
        if (checkEntry) {
            checkEntry.status = 'failed';
            checkEntry.message = message;
        }
    }

    /**
     * Helper: Add warning
     */
    _addWarning(check, message) {
        this.warnings.push({
            check,
            message,
            timestamp: new Date().toISOString()
        });
        
        const checkEntry = this.checks.find(c => c.name === check);
        if (checkEntry) {
            checkEntry.status = 'warning';
            checkEntry.message = message;
        }
    }

    /**
     * Generate deployment gate file
     */
    async generateGateFile(outputPath = './.deployment-gate.json') {
        const report = await this.validate();
        
        const gateFile = {
            ...report,
            gitCommit: process.env.GIT_COMMIT || 'unknown',
            builtAt: new Date().toISOString(),
            builtBy: process.env.USER || 'unknown',
            nodeVersion: process.version,
            environment: process.env.NODE_ENV
        };

        const fs = require('fs');
        fs.writeFileSync(outputPath, JSON.stringify(gateFile, null, 2));
        
        console.log(`📝 [PreDeploy] Gate file written: ${outputPath}`);
        return gateFile;
    }

    /**
     * Read and validate gate file
     */
    static validateGateFile(gateFilePath = './.deployment-gate.json') {
        const fs = require('fs');
        
        if (!fs.existsSync(gateFilePath)) {
            return { valid: false, error: 'Gate file not found' };
        }

        try {
            const gate = JSON.parse(fs.readFileSync(gateFilePath, 'utf8'));
            
            // Check if validation passed
            if (!gate.canDeploy) {
                return { valid: false, error: 'Previous validation failed', gate };
            }

            // Check freshness (max 1 hour old)
            const age = Date.now() - new Date(gate.timestamp).getTime();
            const maxAge = 60 * 60 * 1000; // 1 hour
            
            if (age > maxAge) {
                return { valid: false, error: 'Gate file expired (>1 hour)', gate };
            }

            return { valid: true, gate };

        } catch (error) {
            return { valid: false, error: `Invalid gate file: ${error.message}` };
        }
    }

    /**
     * CI/CD integration - returns exit code
     */
    async runForCI() {
        const report = await this.validate();
        
        if (!report.canDeploy) {
            console.error('\n❌ DEPLOYMENT BLOCKED');
            console.error('Fix the following issues before deploying:\n');
            report.details.blockers.forEach(b => {
                console.error(`  ✗ ${b.check}: ${b.message}`);
            });
            process.exit(1);
        }
        
        console.log('\n✅ DEPLOYMENT APPROVED');
        console.log(`All ${report.checks} checks passed`);
        if (report.warnings > 0) {
            console.log(`⚠️  ${report.warnings} warnings (non-blocking)`);
        }
        process.exit(0);
    }
}

module.exports = PreDeploymentValidator;
