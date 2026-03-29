#!/usr/bin/env node

/**
 * DATA-FIRST CLI - Command Line Interface for Data-First Operations
 * NO EXTERNAL DEPENDENCIES - Pure Node.js
 * 
 * Commands:
 *   validate-schema [schema]  - Run Schema Guard validation
 *   validate-deploy           - Run pre-deployment validation
 *   check-migrations          - Check migration discipline
 *   status                    - Show data-first status
 *   health                    - Run health check
 *   help                      - Show help
 */

const { Sequelize } = require('sequelize');
const config = require('../config/config');

// Import data-first modules
const {
    DataFirstInitializer,
    SchemaGuard,
    MigrationDiscipline,
    SchemaVersionEnforcer,
    PreDeploymentValidator
} = require('../src/architecture/dataFirstInitializer');

// Create sequelize connection
const createSequelize = () => {
    return new Sequelize(config.postgresURI, {
        dialect: 'postgres',
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    });
};

// Simple CLI parser
const args = process.argv.slice(2);
const command = args[0];

function showHelp() {
    console.log(`
Data-First Architecture CLI v1.0.0

Usage: node scripts/data-first-cli.js <command> [options]

Commands:
  validate-schema [schema]  Run Schema Guard validation (default: public)
  validate-deploy           Run pre-deployment validation
  check-migrations          Check migration discipline
  status                    Show data-first status
  health                    Run health check
  help                      Show this help message

Examples:
  node scripts/data-first-cli.js validate-schema
  node scripts/data-first-cli.js validate-schema tenant_abc123
  node scripts/data-first-cli.js validate-deploy
  node scripts/data-first-cli.js check-migrations
`);
}

async function runValidateSchema() {
    const schema = args[1] || 'public';
    const sequelize = createSequelize();
    const guard = new SchemaGuard(sequelize);
    
    try {
        console.log(`🔍 Validating schema: ${schema}`);
        const result = await guard.validate(schema);
        
        console.log(`\n✅ Models checked: ${result.modelsChecked}`);
        console.log(`❌ Mismatches: ${result.mismatches.length}`);
        console.log(`⚠️  Warnings: ${result.warnings.length}`);
        
        if (result.mismatches.length > 0) {
            console.log('\nMismatches:');
            result.mismatches.forEach(m => {
                console.log(`  [${m.severity}] ${m.table}.${m.column}: ${m.message}`);
            });
        }
        
        process.exit(result.passed ? 0 : 1);
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

async function runValidateDeploy() {
    const sequelize = createSequelize();
    const validator = new PreDeploymentValidator(sequelize);
    
    try {
        const report = await validator.validate();
        
        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║        PRE-DEPLOYMENT VALIDATION REPORT               ║');
        console.log('╠════════════════════════════════════════════════════════╣');
        console.log(`║  Can Deploy: ${report.canDeploy ? '✅ YES' : '❌ NO'}${' '.repeat(37)}║`);
        console.log(`║  Checks Run: ${report.checks}${' '.repeat(40)}║`);
        console.log(`║  Blockers: ${report.blockers}${' '.repeat(43)}║`);
        console.log(`║  Warnings: ${report.warnings}${' '.repeat(42)}║`);
        console.log('╚════════════════════════════════════════════════════════╝\n');
        
        if (report.details.blockers.length > 0) {
            console.log('Blockers:');
            report.details.blockers.forEach(b => {
                console.log(`  ❌ ${b.check}: ${b.message}`);
            });
        }
        
        process.exit(report.canDeploy ? 0 : 1);
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

async function runCheckMigrations() {
    const sequelize = createSequelize();
    const discipline = new MigrationDiscipline(sequelize);
    
    try {
        console.log('🔍 Checking migration discipline...');
        const status = await discipline.status();
        
        console.log(`\nModels tracked: ${status.modelsTracked}`);
        console.log(`Changes detected: ${status.changesDetected}`);
        console.log(`Critical changes: ${status.criticalChanges}`);
        console.log(`Migration files: ${status.migrationFiles}`);
        console.log(`Executed: ${status.executedMigrations}`);
        console.log(`Pending: ${status.pendingMigrations}`);
        
        if (status.changes.length > 0) {
            console.log('\nDetected changes:');
            status.changes.forEach(c => {
                console.log(`  [${c.type}] ${c.model}: ${c.message}`);
            });
        }
        
        process.exit(status.criticalChanges > 0 ? 1 : 0);
    } catch (error) {
        console.error('❌ Check failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

async function runStatus() {
    const sequelize = createSequelize();
    
    try {
        const { SchemaVersionEnforcer } = require('../src/architecture/schemaVersionEnforcer');
        const enforcer = new SchemaVersionEnforcer(sequelize);
        
        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║              DATA-FIRST ARCHITECTURE STATUS           ║');
        console.log('╠════════════════════════════════════════════════════════╣');
        
        const status = enforcer.getStatus();
        console.log(`║  Min Schema Version: ${status.minSupportedVersion.padEnd(33)}║`);
        console.log(`║  Version Check: ${status.versionCheckEnabled ? '✅ ENABLED' : '❌ DISABLED'}${' '.repeat(28)}║`);
        console.log(`║  Cache Size: ${String(status.cacheSize).padEnd(39)}║`);
        console.log('╚════════════════════════════════════════════════════════╝\n');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Status check failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

async function runHealth() {
    const sequelize = createSequelize();
    const initializer = new DataFirstInitializer(sequelize, { 
        skipMigrationDiscipline: true 
    });
    
    try {
        const health = await initializer.healthCheck();
        
        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║                   HEALTH CHECK                         ║');
        console.log('╠════════════════════════════════════════════════════════╣');
        console.log(`║  Overall: ${health.status === 'healthy' ? '✅ HEALTHY' : '⚠️ DEGRADED'}${' '.repeat(37)}║`);
        console.log('╠════════════════════════════════════════════════════════╣');
        
        Object.entries(health.checks).forEach(([name, check]) => {
            const status = check.status === 'healthy' || check.status === 'ok' ? '✅' : '⚠️';
            console.log(`║  ${status} ${name.padEnd(48)}║`);
        });
        
        console.log('╚════════════════════════════════════════════════════════╝\n');
        
        process.exit(health.status === 'healthy' ? 0 : 1);
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Main
async function main() {
    switch (command) {
        case 'validate-schema':
            await runValidateSchema();
            break;
        case 'validate-deploy':
            await runValidateDeploy();
            break;
        case 'check-migrations':
            await runCheckMigrations();
            break;
        case 'status':
            await runStatus();
            break;
        case 'health':
            await runHealth();
            break;
        case 'help':
        case '--help':
        case '-h':
        default:
            showHelp();
            process.exit(command ? 1 : 0);
    }
}

main().catch(err => {
    console.error('💥 Fatal error:', err.message);
    process.exit(1);
});
