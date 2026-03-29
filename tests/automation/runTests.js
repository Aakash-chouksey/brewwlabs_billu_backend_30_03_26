/**
 * MAIN AUTOMATION TEST RUNNER
 * ===========================
 * 
 * Orchestrates all test modules and generates final report
 */

const path = require('path');
const fs = require('fs');

// Core modules
const { 
  CONFIG, 
  logger, 
  testResults, 
  SystemResetModule, 
  OnboardingValidationModule 
} = require('./core/testFramework');

const { 
  DatabaseStructureModule, 
  DataIntegrityModule, 
  ModelConsistencyModule 
} = require('./core/databaseValidation');

const { 
  AuthValidationModule, 
  APITestModule 
} = require('./core/authAndAPITests');

const { 
  DataExpectationModule, 
  HiddenIssueDetectionModule, 
  RootCauseAnalyzer 
} = require('./core/advancedDetection');

/**
 * Main Test Orchestrator
 */
class AutomationTestRunner {
  constructor(options = {}) {
    this.options = {
      skipReset: false,
      skipOnboarding: false,
      skipAPI: false,
      generateReport: true,
      fixIssues: true,
      ...options
    };
    
    this.testContext = {};
    this.allResults = {};
  }
  
  async run() {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║           PLATFORM-WIDE AUTOMATION TEST SYSTEM                               ║
║           Multi-Tenant POS Platform Validation Suite                         ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
    `);
    
    testResults.startTime = new Date();
    logger.info('Starting comprehensive platform automation test...');
    logger.info(`Configuration: ${JSON.stringify(CONFIG, null, 2)}`);
    
    try {
      // Step 1: System Reset
      if (!this.options.skipReset) {
        const resetModule = new SystemResetModule();
        this.allResults.reset = await resetModule.execute();
      }
      
      // Step 2: Onboarding Validation
      if (!this.options.skipOnboarding) {
        const onboardingModule = new OnboardingValidationModule();
        this.allResults.onboarding = await onboardingModule.execute();
        this.testContext.tenant = onboardingModule.getTestTenant();
      }
      
      if (!this.testContext.tenant) {
        throw new Error('No test tenant available - onboarding may have failed');
      }
      
      // Step 3: Database Structure Validation
      const dbStructureModule = new DatabaseStructureModule(this.testContext.tenant);
      this.allResults.database = await dbStructureModule.execute();
      
      // Step 4: Data Integrity Validation
      const dataIntegrityModule = new DataIntegrityModule(this.testContext.tenant);
      this.allResults.data = await dataIntegrityModule.execute();
      
      // Step 5: Model Consistency Check
      const modelModule = new ModelConsistencyModule(this.testContext.tenant);
      this.allResults.model = await modelModule.execute();
      
      // Step 6: Auth Validation
      const authModule = new AuthValidationModule(this.testContext.tenant);
      this.allResults.auth = await authModule.execute();
      this.testContext.authToken = authModule.getAuthToken();
      
      // Step 7: API Test Suite
      if (!this.options.skipAPI) {
        const apiModule = new APITestModule(
          this.testContext.tenant, 
          this.testContext.authToken
        );
        this.allResults.api = await apiModule.execute();
      }
      
      // Step 8: Data Expectation Check
      const expectationModule = new DataExpectationModule(
        this.testContext.tenant,
        this.allResults.api?.results || []
      );
      this.allResults.expectations = await expectationModule.execute();
      
      // Step 9: Hidden Issue Detection
      const hiddenIssuesModule = new HiddenIssueDetectionModule(
        this.testContext.tenant,
        this.allResults.api?.results || []
      );
      this.allResults.hidden = await hiddenIssuesModule.execute();
      
      // Step 10: Root Cause Analysis
      const rootCauseAnalyzer = new RootCauseAnalyzer(this.allResults);
      this.allResults.rootCauses = await rootCauseAnalyzer.execute();
      
      // Step 11: Auto-Fix (if enabled)
      if (this.options.fixIssues) {
        const { AutoFixModule } = require('./core/autoFix');
        const autoFix = new AutoFixModule(this.allResults);
        this.allResults.fixes = await autoFix.execute();
      }
      
      // Generate final report
      if (this.options.generateReport) {
        await this.generateReport();
      }
      
      testResults.endTime = new Date();
      this.printSummary();
      
      return {
        success: this.isOverallSuccess(),
        results: this.allResults,
        summary: this.getSummary()
      };
      
    } catch (error) {
      logger.error('Test suite execution failed', error);
      testResults.endTime = new Date();
      
      return {
        success: false,
        error: error.message,
        results: this.allResults,
        summary: this.getSummary()
      };
    }
  }
  
  isOverallSuccess() {
    const criticalSteps = [
      this.allResults.onboarding?.success,
      this.allResults.database?.success,
      this.allResults.auth?.success
    ];
    
    return criticalSteps.every(result => result === true);
  }
  
  getSummary() {
    const duration = testResults.endTime && testResults.startTime
      ? (testResults.endTime - testResults.startTime) / 1000
      : 0;
    
    return {
      duration: `${duration.toFixed(2)}s`,
      testsRun: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      warnings: testResults.warnings,
      issuesFound: testResults.issues.length,
      success: this.isOverallSuccess()
    };
  }
  
  printSummary() {
    const summary = this.getSummary();
    
    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                           TEST EXECUTION SUMMARY                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Duration:        ${summary.duration.padEnd(57)}║
║  Tests Passed:    ${String(summary.passed).padEnd(57)}║
║  Tests Failed:    ${String(summary.failed).padEnd(57)}║
║  Warnings:        ${String(summary.warnings).padEnd(57)}║
║  Issues Found:    ${String(summary.issuesFound).padEnd(57)}║
║                                                                              ║
║  Overall Status: ${summary.success ? '✅ SUCCESS' : '❌ FAILED'}${''.padEnd(50)}║
╚══════════════════════════════════════════════════════════════════════════════╝
    `);
    
    // Print detailed results per step
    console.log('\n📋 DETAILED RESULTS:');
    console.log('─'.repeat(80));
    
    const stepResults = [
      { name: 'System Reset', result: this.allResults.reset },
      { name: 'Onboarding', result: this.allResults.onboarding },
      { name: 'Database Structure', result: this.allResults.database },
      { name: 'Data Integrity', result: this.allResults.data },
      { name: 'Model Consistency', result: this.allResults.model },
      { name: 'Authentication', result: this.allResults.auth },
      { name: 'API Tests', result: this.allResults.api },
      { name: 'Data Expectations', result: this.allResults.expectations },
      { name: 'Hidden Issues', result: this.allResults.hidden },
      { name: 'Root Causes', result: this.allResults.rootCauses },
      { name: 'Auto-Fixes', result: this.allResults.fixes }
    ];
    
    for (const step of stepResults) {
      if (step.result) {
        const status = step.result.success !== undefined 
          ? (step.result.success ? '✅' : '❌')
          : '⏭️';
        console.log(`  ${status} ${step.name}`);
      }
    }
    
    console.log('─'.repeat(80));
  }
  
  async generateReport() {
    logger.info('Generating test report...');
    
    const reportPath = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportPath)) {
      fs.mkdirSync(reportPath, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `automation-report-${timestamp}.json`;
    const filepath = path.join(reportPath, filename);
    
    const report = {
      meta: {
        timestamp: new Date().toISOString(),
        duration: this.getSummary().duration,
        version: '1.0.0'
      },
      summary: this.getSummary(),
      context: {
        tenant: this.testContext.tenant,
        // Don't include auth token for security
      },
      results: this.allResults,
      issues: testResults.issues,
      configuration: CONFIG
    };
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    logger.success(`Report saved to: ${filepath}`);
    
    // Also generate HTML report
    const htmlFilename = `automation-report-${timestamp}.html`;
    const htmlFilepath = path.join(reportPath, htmlFilename);
    const htmlContent = this.generateHTMLReport(report);
    fs.writeFileSync(htmlFilepath, htmlContent);
    logger.success(`HTML report saved to: ${htmlFilepath}`);
  }
  
  generateHTMLReport(report) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Automation Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 30px;
        }
        h1 { color: #1a1a1a; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
        h2 { color: #333; margin-top: 30px; }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .summary-card {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 15px;
            border-left: 4px solid #007bff;
        }
        .summary-card.success { border-left-color: #28a745; }
        .summary-card.error { border-left-color: #dc3545; }
        .summary-card.warning { border-left-color: #ffc107; }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        .status-success { background: #d4edda; color: #155724; }
        .status-error { background: #f8d7da; color: #721c24; }
        .status-warning { background: #fff3cd; color: #856404; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }
        th { background: #f8f9fa; font-weight: 600; }
        tr:hover { background: #f8f9fa; }
        pre {
            background: #f4f4f4;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 13px;
        }
        .issue-card {
            background: #f8f9fa;
            border-left: 4px solid #dc3545;
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Platform Automation Test Report</h1>
        <p>Generated: ${report.meta.timestamp}</p>
        
        <h2>📊 Summary</h2>
        <div class="summary-grid">
            <div class="summary-card ${report.summary.success ? 'success' : 'error'}">
                <strong>Duration</strong><br>
                ${report.summary.duration}
            </div>
            <div class="summary-card success">
                <strong>Tests Passed</strong><br>
                ${report.summary.passed}
            </div>
            <div class="summary-card ${report.summary.failed > 0 ? 'error' : 'success'}">
                <strong>Tests Failed</strong><br>
                ${report.summary.failed}
            </div>
            <div class="summary-card ${report.summary.warnings > 0 ? 'warning' : 'success'}">
                <strong>Warnings</strong><br>
                ${report.summary.warnings}
            </div>
        </div>
        
        <h2>🎯 Overall Status</h2>
        <span class="status-badge ${report.summary.success ? 'status-success' : 'status-error'}">
            ${report.summary.success ? '✅ SUCCESS' : '❌ FAILED'}
        </span>
        
        <h2>📋 Step Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Step</th>
                    <th>Status</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>System Reset</td>
                    <td><span class="status-badge ${report.results.reset?.success ? 'status-success' : 'status-error'}">${report.results.reset?.success ? '✅' : '❌'}</span></td>
                    <td>Database cleaned and reset</td>
                </tr>
                <tr>
                    <td>Onboarding</td>
                    <td><span class="status-badge ${report.results.onboarding?.success ? 'status-success' : 'status-error'}">${report.results.onboarding?.success ? '✅' : '❌'}</span></td>
                    <td>Tenant creation and setup</td>
                </tr>
                <tr>
                    <td>Database Structure</td>
                    <td><span class="status-badge ${report.results.database?.success ? 'status-success' : 'status-error'}">${report.results.database?.success ? '✅' : '❌'}</span></td>
                    <td>Schema and table validation</td>
                </tr>
                <tr>
                    <td>Data Integrity</td>
                    <td><span class="status-badge ${report.results.data?.success ? 'status-success' : 'status-error'}">${report.results.data?.success ? '✅' : '❌'}</span></td>
                    <td>Required data presence</td>
                </tr>
                <tr>
                    <td>Model Consistency</td>
                    <td><span class="status-badge ${report.results.model?.success ? 'status-success' : 'status-error'}">${report.results.model?.success ? '✅' : '❌'}</span></td>
                    <td>Model-DB alignment</td>
                </tr>
                <tr>
                    <td>Authentication</td>
                    <td><span class="status-badge ${report.results.auth?.success ? 'status-success' : 'status-error'}">${report.results.auth?.success ? '✅' : '❌'}</span></td>
                    <td>Login and token validation</td>
                </tr>
                <tr>
                    <td>API Tests</td>
                    <td><span class="status-badge ${report.results.api?.success ? 'status-success' : 'status-warning'}">${report.results.api?.success ? '✅' : '⚠️'}</span></td>
                    <td>${report.results.api?.passed || 0}/${report.results.api?.total || 0} passed</td>
                </tr>
            </tbody>
        </table>
        
        <h2>⚠️ Issues Found</h2>
        ${report.issues.length > 0 
            ? report.issues.map(issue => `
                <div class="issue-card">
                    <strong>${issue.level}:</strong> ${issue.message}<br>
                    <small>${issue.timestamp}</small>
                    ${issue.data ? `<pre>${JSON.stringify(issue.data, null, 2)}</pre>` : ''}
                </div>
            `).join('')
            : '<p>No issues found! 🎉</p>'
        }
        
        <h2>🔧 Root Causes Identified</h2>
        ${report.results.rootCauses?.rootCauses?.length > 0
            ? `<table>
                <thead>
                    <tr><th>Layer</th><th>Error</th><th>Location</th><th>Suggested Fix</th></tr>
                </thead>
                <tbody>
                    ${report.results.rootCauses.rootCauses.map(c => `
                        <tr>
                            <td>${c.layer}</td>
                            <td>${c.error || 'N/A'}</td>
                            <td>${c.location || 'Unknown'}</td>
                            <td>${c.suggestedFix || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`
            : '<p>No root causes identified.</p>'
        }
        
        <h2>📄 Full Results (JSON)</h2>
        <pre>${JSON.stringify(report.results, null, 2)}</pre>
    </div>
</body>
</html>`;
  }
}

// Run if executed directly
if (require.main === module) {
  const runner = new AutomationTestRunner({
    skipReset: process.env.SKIP_RESET === 'true',
    skipOnboarding: process.env.SKIP_ONBOARDING === 'true',
    skipAPI: process.env.SKIP_API === 'true',
    generateReport: true,
    fixIssues: process.env.AUTO_FIX !== 'false'
  });
  
  runner.run().then(result => {
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { AutomationTestRunner };
