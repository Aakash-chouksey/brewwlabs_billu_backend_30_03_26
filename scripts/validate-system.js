/**
 * SYSTEM VALIDATION ORCHESTRATOR
 * 
 * Master script that runs all validation steps in sequence
 * and generates a comprehensive markdown report.
 */

const { sequelize } = require('../config/unified_database');
const colors = require('colors');
const fs = require('fs');
const path = require('path');

// Import all validation modules
const DatabaseReset = require('./steps/01-database-reset');
const OnboardingTest = require('./steps/02-onboarding-test');
const SchemaValidator = require('./steps/03-schema-validation');
const FKValidator = require('./steps/04-fk-validation');
const MigrationValidator = require('./steps/05-migration-validation');
const ModelSyncChecker = require('./steps/06-model-sync-checker');
const LoginFlowTest = require('./steps/07-login-flow-test');
const APITestSuite = require('./steps/08-api-test-suite');
const TransactionSafety = require('./steps/09-transaction-safety');
const AutoFixEngine = require('./steps/10-auto-fix-engine');

class SystemValidator {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            status: 'PASS',
            steps: [],
            issues: [],
            fixes: []
        };
        this.testData = {
            businessId: null,
            schemaName: null,
            token: null,
            userId: null
        };
    }

    async runAll() {
        console.log(colors.bold.blue('\n╔════════════════════════════════════════════════════════════╗'));
        console.log(colors.bold.blue('║       MULTI-TENANT POS SYSTEM VALIDATION SUITE          ║'));
        console.log(colors.bold.blue('╚════════════════════════════════════════════════════════════╝\n'));

        try {
            // Step 1: Database Reset
            await this.runStep('Database Reset', () => DatabaseReset.execute(sequelize));

            // Step 2: Onboarding Test
            const onboardingTask = await this.runStep('Tenant Onboarding', () => OnboardingTest.execute(sequelize));
            if (!onboardingTask.success) throw new Error('Onboarding failed. Stopping validator.');
            
            this.testData.businessId = onboardingTask.businessId;
            this.testData.schemaName = onboardingTask.schemaName;

            // Step 3-6: Schema & Migrations
            await this.runStep('Schema Verification', () => SchemaValidator.execute(sequelize, this.testData.schemaName));
            await this.runStep('Foreign Key Integrity', () => FKValidator.execute(sequelize, this.testData.schemaName));
            await this.runStep('Migration Audit', () => MigrationValidator.execute(sequelize, this.testData.schemaName));
            await this.runStep('Model vs DB Sync', () => ModelSyncChecker.execute(sequelize, this.testData.schemaName));

            // Step 7: Login Flow
            const loginTask = await this.runStep('Authentication Flow', () => LoginFlowTest.execute(sequelize, {
                email: onboardingTask.adminEmail,
                password: onboardingTask.adminPassword
            }));
            this.testData.token = loginTask.token;

            // Step 8: API Test Suite
            await this.runStep('API Connectivity', () => APITestSuite.execute({
                token: this.testData.token,
                businessId: this.testData.businessId
            }));

            // Step 9: Transaction Safety
            await this.runStep('Transaction Abort Detection', () => TransactionSafety.execute(sequelize, this.testData.schemaName));

            // Step 10: Auto-Fix Suggestions
            const fixTask = await this.runStep('Auto-Fix Generation', () => AutoFixEngine.analyze(this.results.issues));
            this.results.fixes = fixTask.fixes;

        } catch (error) {
            this.results.status = 'FAIL';
            console.error(colors.red(`\n❌ Validation suite HALTED: ${error.message}`));
        }

        // Final Report Generation
        this.generateFinalReport();
        return this.results;
    }

    async runStep(name, stepFn) {
        console.log(colors.bold.yellow(`\n▶ Step: ${name}`));
        const start = Date.now();
        let result = { success: false };

        try {
            result = await stepFn();
            const duration = Date.now() - start;
            
            this.results.steps.push({ name, status: result.success ? 'PASS' : 'FAIL', duration, details: result });
            
            if (!result.success) {
                this.results.status = 'FAIL';
                if (result.issues) this.results.issues.push(...result.issues);
            }

            console.log(result.success 
                ? colors.green(`✅ ${name} - PASSED (${duration}ms)`) 
                : colors.red(`❌ ${name} - FAILED (${duration}ms)`)
            );
        } catch (err) {
            this.results.status = 'FAIL';
            this.results.issues.push({ severity: 'CRITICAL', message: `Step ${name} execution error: ${err.message}` });
            console.log(colors.red(`❌ ${name} - EXCEPTION: ${err.message}`));
        }

        return result;
    }

    generateFinalReport() {
        const reportPath = path.join(process.cwd(), 'VALIDATION_FINAL_REPORT.md');
        let md = `# SYSTEM VALIDATION FINAL REPORT\n\n`;
        md += `**Status:** ${this.results.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}\n`;
        md += `**Timestamp:** ${this.results.timestamp}\n\n`;

        md += `## Issues Found (${this.results.issues.length})\n\n`;
        if (this.results.issues.length === 0) {
            md += `* No critical data inconsistency issues found.\n`;
        } else {
            this.results.issues.forEach((issue, idx) => {
                md += `### Issue ${idx + 1}: [${issue.severity}] ${issue.message}\n`;
                if (issue.details) md += `- **Details:** \`${JSON.stringify(issue.details)}\`\n`;
                md += `\n`;
            });
        }

        md += `## Exact Fixes Required\n\n`;
        if (this.results.fixes.length === 0) {
            md += `* No auto-fixes available.\n`;
        } else {
            this.results.fixes.forEach((fix, idx) => {
                md += `### Fix ${idx + 1}: ${fix.issue}\n`;
                md += `- **Action:** \`${fix.action}\`\n`;
                md += `- **Target File:** \`${fix.file}\`\n`;
                md += `- **Exact Code Changes:**\n\n\`\`\`javascript\n${fix.code}\n\`\`\`\n\n`;
            });
        }

        md += `## Step Execution Details\n\n`;
        md += `| Step Name | Status | Duration |\n| --- | --- | --- |\n`;
        this.results.steps.forEach(s => {
            md += `| ${s.name} | ${s.status === 'PASS' ? '✅' : '❌'} | ${s.duration}ms |\n`;
        });

        fs.writeFileSync(reportPath, md);
        console.log(colors.bold.blue(`\nFinal Report: ${reportPath}`));
    }
}

// CLI Runner
if (require.main === module) {
    new SystemValidator().runAll().then(r => process.exit(r.status === 'PASS' ? 0 : 1));
}

module.exports = SystemValidator;
