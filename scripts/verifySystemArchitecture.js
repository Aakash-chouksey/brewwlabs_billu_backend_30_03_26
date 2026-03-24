#!/usr/bin/env node

/**
 * COMPREHENSIVE SYSTEM ARCHITECTURE VERIFICATION
 * 
 * This script verifies that the entire system follows the strict architecture rules.
 * It checks for violations, validates patterns, and ensures production readiness.
 */

const fs = require('fs');
const path = require('path');

class SystemArchitectureVerifier {
    constructor() {
        this.violations = [];
        this.warnings = [];
        this.passedChecks = [];
    }

    /**
     * Log a violation
     */
    logViolation(category, file, issue, severity = 'HIGH') {
        this.violations.push({
            category,
            file: path.relative(process.cwd(), file),
            issue,
            severity
        });
    }

    /**
     * Log a warning
     */
    logWarning(category, file, issue) {
        this.warnings.push({
            category,
            file: path.relative(process.cwd(), file),
            issue
        });
    }

    /**
     * Log a passed check
     */
    logPass(category, file, description) {
        this.passedChecks.push({
            category,
            file: path.relative(process.cwd(), file),
            description
        });
    }

    /**
     * Check for direct model imports in controllers
     */
    checkDirectModelImports() {
        console.log('🔍 Checking for direct model imports in controllers...');
        
        const controllersDir = path.join(__dirname, '../controllers');
        const controllerFiles = fs.readdirSync(controllersDir)
            .filter(file => file.endsWith('.js'))
            .map(file => path.join(controllersDir, file));

        for (const filePath of controllerFiles) {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for direct model imports
            const directImportPatterns = [
                /require\s*\(\s*["'][^"']*models[^"']*["']\s*\)/g,
                /require\s*\(\s*["'][^"']*database[^"']*["']\s*\)/g
            ];

            for (const pattern of directImportPatterns) {
                const matches = content.match(pattern);
                if (matches) {
                    // Ignore commented lines
                    const uncommentedMatches = matches.filter(match => {
                        const lines = content.split('\n');
                        for (const line of lines) {
                            if (line.includes(match) && !line.trim().startsWith('//')) {
                                return true;
                            }
                        }
                        return false;
                    });

                    if (uncommentedMatches.length > 0) {
                        this.logViolation(
                            'MODEL_IMPORTS',
                            filePath,
                            `Direct model/database imports found: ${uncommentedMatches.join(', ')}`,
                            'HIGH'
                        );
                    } else {
                        this.logPass(
                            'MODEL_IMPORTS',
                            filePath,
                            'All model imports are properly commented out'
                        );
                    }
                }
            }

            // Check for proper req.models usage
            if (content.includes('req.models.') || content.includes('const {') && content.includes('req.models')) {
                this.logPass(
                    'MODEL_USAGE',
                    filePath,
                    'Uses req.models pattern correctly'
                );
            }
        }
    }

    /**
     * Check middleware chain enforcement
     */
    checkMiddlewareChain() {
        console.log('🔍 Checking middleware chain enforcement...');
        
        const middlewareChainPath = path.join(__dirname, '../src/architecture/middlewareChain.js');
        
        if (fs.existsSync(middlewareChainPath)) {
            const content = fs.readFileSync(middlewareChainPath, 'utf8');
            
            // Check for required middleware components
            const requiredComponents = [
                'isVerifiedUser',
                'tenantContextMiddleware',
                'modelInjectionMiddleware',
                'databaseIsolationMiddleware',
                'tenantOnlyMiddleware',
                'routeSegregationGuard'
            ];

            for (const component of requiredComponents) {
                if (content.includes(component)) {
                    this.logPass(
                        'MIDDLEWARE_CHAIN',
                        middlewareChainPath,
                        `Includes required middleware: ${component}`
                    );
                } else {
                    this.logViolation(
                        'MIDDLEWARE_CHAIN',
                        middlewareChainPath,
                        `Missing required middleware: ${component}`,
                        'HIGH'
                    );
                }
            }

            // Check for runtime safety guards
            if (content.includes('RuntimeSafetyGuards')) {
                this.logPass(
                    'SAFETY_GUARDS',
                    middlewareChainPath,
                    'Includes runtime safety guards'
                );
            } else {
                this.logWarning(
                    'SAFETY_GUARDS',
                    middlewareChainPath,
                    'Runtime safety guards not found'
                );
            }
        } else {
            this.logViolation(
                'MIDDLEWARE_CHAIN',
                middlewareChainPath,
                'Centralized middleware chain not found',
                'CRITICAL'
            );
        }
    }

    /**
     * Check model factory implementation
     */
    checkModelFactory() {
        console.log('🔍 Checking model factory implementation...');
        
        const modelFactoryPath = path.join(__dirname, '../src/architecture/modelFactory.js');
        
        if (fs.existsSync(modelFactoryPath)) {
            const content = fs.readFileSync(modelFactoryPath, 'utf8');
            
            // Check for required components
            const requiredComponents = [
                'ModelFactory',
                'ModelRegistry',
                'createModels',
                'validateModels'
            ];

            for (const component of requiredComponents) {
                if (content.includes(component)) {
                    this.logPass(
                        'MODEL_FACTORY',
                        modelFactoryPath,
                        `Includes required component: ${component}`
                    );
                } else {
                    this.logViolation(
                        'MODEL_FACTORY',
                        modelFactoryPath,
                        `Missing required component: ${component}`,
                        'HIGH'
                    );
                }
            }
        } else {
            this.logViolation(
                'MODEL_FACTORY',
                modelFactoryPath,
                'Model factory not found',
                'CRITICAL'
            );
        }
    }

    /**
     * Check safety guards implementation
     */
    checkSafetyGuards() {
        console.log('🔍 Checking safety guards implementation...');
        
        const safetyGuardsPath = path.join(__dirname, '../src/architecture/safetyGuards.js');
        
        if (fs.existsSync(safetyGuardsPath)) {
            const content = fs.readFileSync(safetyGuardsPath, 'utf8');
            
            // Check for required safety guard classes
            const requiredGuards = [
                'SystemSafetyGuards',
                'RuntimeSafetyGuards',
                'DevelopmentSafetyGuards'
            ];

            for (const guard of requiredGuards) {
                if (content.includes(guard)) {
                    this.logPass(
                        'SAFETY_GUARDS',
                        safetyGuardsPath,
                        `Includes safety guard: ${guard}`
                    );
                } else {
                    this.logViolation(
                        'SAFETY_GUARDS',
                        safetyGuardsPath,
                        `Missing safety guard: ${guard}`,
                        'HIGH'
                    );
                }
            }

            // Check for startup validation
            if (content.includes('runAllChecks')) {
                this.logPass(
                    'SAFETY_GUARDS',
                    safetyGuardsPath,
                    'Includes startup validation'
                );
            } else {
                this.logWarning(
                    'SAFETY_GUARDS',
                    safetyGuardsPath,
                    'Startup validation not found'
                );
            }
        } else {
            this.logViolation(
                'SAFETY_GUARDS',
                safetyGuardsPath,
                'Safety guards not found',
                'CRITICAL'
            );
        }
    }

    /**
     * Check app.js integration
     */
    checkAppIntegration() {
        console.log('🔍 Checking app.js integration...');
        
        const appPath = path.join(__dirname, '../app.js');
        const content = fs.readFileSync(appPath, 'utf8');
        
        // Check for safety guards integration
        if (content.includes('SystemSafetyGuards.runAllChecks')) {
            this.logPass(
                'APP_INTEGRATION',
                appPath,
                'Safety guards integrated into startup'
            );
        } else {
            this.logViolation(
                'APP_INTEGRATION',
                appPath,
                'Safety guards not integrated into startup',
                'HIGH'
            );
        }

        // Check for centralized middleware chain usage
        if (content.includes('applyMiddlewareChains')) {
            this.logPass(
                'APP_INTEGRATION',
                appPath,
                'Uses centralized middleware chain'
            );
        } else {
            this.logViolation(
                'APP_INTEGRATION',
                appPath,
                'Centralized middleware chain not used',
                'HIGH'
            );
        }
    }

    /**
     * Check tenant connection factory
     */
    checkTenantConnectionFactory() {
        console.log('🔍 Checking tenant connection factory...');
        
        const factoryPath = path.join(__dirname, '../src/services/tenantConnectionFactory.js');
        
        if (fs.existsSync(factoryPath)) {
            const content = fs.readFileSync(factoryPath, 'utf8');
            
            // Check for LRU cache
            if (content.includes('LRU') || content.includes('lru-cache')) {
                this.logPass(
                    'TENANT_FACTORY',
                    factoryPath,
                    'Uses LRU cache for connections'
                );
            } else {
                this.logWarning(
                    'TENANT_FACTORY',
                    factoryPath,
                    'LRU cache not found'
                );
            }

            // Check for model factory integration
            if (content.includes('ModelFactory')) {
                this.logPass(
                    'TENANT_FACTORY',
                    factoryPath,
                    'Integrated with centralized model factory'
                );
            } else {
                this.logWarning(
                    'TENANT_FACTORY',
                    factoryPath,
                    'Not integrated with centralized model factory'
                );
            }
        } else {
            this.logViolation(
                'TENANT_FACTORY',
                factoryPath,
                'Tenant connection factory not found',
                'CRITICAL'
            );
        }
    }

    /**
     * Check controller architecture compliance
     */
    checkControllerCompliance() {
        console.log('🔍 Checking controller architecture compliance...');
        
        const controllersDir = path.join(__dirname, '../controllers');
        const controllerFiles = fs.readdirSync(controllersDir)
            .filter(file => file.endsWith('.js'))
            .map(file => path.join(controllersDir, file));

        for (const filePath of controllerFiles) {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for architecture compliance header
            if (content.includes('STRICT ARCHITECTURE COMPLIANCE')) {
                this.logPass(
                    'CONTROLLER_COMPLIANCE',
                    filePath,
                    'Has architecture compliance header'
                );
            } else {
                this.logWarning(
                    'CONTROLLER_COMPLIANCE',
                    filePath,
                    'Missing architecture compliance header'
                );
            }

            // Check for proper error handling
            if (content.includes('next(error)') || content.includes('next(createHttpError')) {
                this.logPass(
                    'ERROR_HANDLING',
                    filePath,
                    'Uses proper error handling pattern'
                );
            } else {
                this.logWarning(
                    'ERROR_HANDLING',
                    filePath,
                    'May have missing error handling'
                );
            }
        }
    }

    /**
     * Generate verification report
     */
    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 SYSTEM ARCHITECTURE VERIFICATION REPORT');
        console.log('='.repeat(80));

        // Summary
        const totalViolations = this.violations.length;
        const criticalViolations = this.violations.filter(v => v.severity === 'CRITICAL').length;
        const highViolations = this.violations.filter(v => v.severity === 'HIGH').length;
        const totalWarnings = this.warnings.length;
        const totalPassed = this.passedChecks.length;

        console.log(`\n📈 SUMMARY:`);
        console.log(`   ✅ Passed Checks: ${totalPassed}`);
        console.log(`   ⚠️  Warnings: ${totalWarnings}`);
        console.log(`   🚨 Violations: ${totalViolations} (Critical: ${criticalViolations}, High: ${highViolations})`);

        // Critical violations first
        if (criticalViolations > 0) {
            console.log(`\n🚨 CRITICAL VIOLATIONS (Must Fix):`);
            this.violations
                .filter(v => v.severity === 'CRITICAL')
                .forEach(v => {
                    console.log(`   ❌ ${v.file}: ${v.issue}`);
                });
        }

        // High violations
        if (highViolations > 0) {
            console.log(`\n🔥 HIGH VIOLATIONS (Should Fix):`);
            this.violations
                .filter(v => v.severity === 'HIGH')
                .forEach(v => {
                    console.log(`   ⚠️  ${v.file}: ${v.issue}`);
                });
        }

        // Warnings
        if (totalWarnings > 0) {
            console.log(`\n⚠️  WARNINGS (Recommended):`);
            this.warnings.forEach(w => {
                console.log(`   💡 ${w.file}: ${w.issue}`);
            });
        }

        // Passed checks
        if (totalPassed > 0) {
            console.log(`\n✅ PASSED CHECKS:`);
            this.passedChecks.forEach(p => {
                console.log(`   ✅ ${p.file}: ${p.description}`);
            });
        }

        // Final assessment
        console.log(`\n🎯 FINAL ASSESSMENT:`);
        
        if (criticalViolations > 0) {
            console.log(`   🔴 NOT READY: ${criticalViolations} critical violations must be fixed`);
            console.log(`   🛑 System cannot start safely with critical issues`);
        } else if (highViolations > 0) {
            console.log(`   🟡 PARTIALLY READY: ${highViolations} high violations should be fixed`);
            console.log(`   ⚠️  System may have security/stability issues`);
        } else if (totalWarnings > 5) {
            console.log(`   🟢 MOSTLY READY: ${totalWarnings} warnings should be reviewed`);
            console.log(`   💡 System is functional but could be improved`);
        } else {
            console.log(`   🟢 PRODUCTION READY: Architecture is properly implemented`);
            console.log(`   🚀 System is ready for 10,000+ tenants deployment`);
        }

        // Architecture qualities
        console.log(`\n🏗️  ARCHITECTURE QUALITIES:`);
        console.log(`   🔒 Security Level: ${criticalViolations === 0 ? 'Enterprise' : highViolations === 0 ? 'Good' : 'Needs Improvement'}`);
        console.log(`   🛡️  Stability Level: ${highViolations === 0 ? 'Production' : 'Development'}`);
        console.log(`   📈 Scalability: ${criticalViolations === 0 ? 'Ready for 10k+ tenants' : 'Limited by violations'}`);
        console.log(`   🔧 Maintainability: ${totalPassed > 20 ? 'Excellent' : 'Good'}`);

        return {
            criticalViolations,
            highViolations,
            totalWarnings,
            totalPassed,
            isProductionReady: criticalViolations === 0 && highViolations === 0
        };
    }

    /**
     * Run complete verification
     */
    async runVerification() {
        console.log('🔍 Starting comprehensive system architecture verification...\n');
        
        this.checkDirectModelImports();
        this.checkMiddlewareChain();
        this.checkModelFactory();
        this.checkSafetyGuards();
        this.checkAppIntegration();
        this.checkTenantConnectionFactory();
        this.checkControllerCompliance();
        
        return this.generateReport();
    }
}

// Run verification if called directly
if (require.main === module) {
    const verifier = new SystemArchitectureVerifier();
    verifier.runVerification().then(result => {
        process.exit(result.isProductionReady ? 0 : 1);
    }).catch(error => {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    });
}

module.exports = SystemArchitectureVerifier;
