/**
 * Main E2E Test Orchestrator
 * Coordinates all test modules and generates final report
 */

const { TEST_STATE } = require('./config');
const { TestUtils, TestLogger, COLORS } = require('./utils');
const OnboardingTest = require('./onboardingTest');
const AuthTest = require('./authTest');
const TenantAPITest = require('./tenantAPITest');
const DatabaseVerification = require('./databaseVerification');
const HiddenIssueDetector = require('./hiddenIssueDetector');

class E2ETestOrchestrator {
  constructor() {
    this.results = {};
  }
  
  async run() {
    TEST_STATE.startTime = Date.now();
    
    console.log(`\n${COLORS.bright}${COLORS.cyan}`);
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║          BACKEND E2E TEST AUTOMATION SYSTEM                ║');
    console.log('║     Multi-Tenant POS - Full Lifecycle Validation         ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`${COLORS.reset}\n`);
    
    try {
      // Phase 1: Onboarding
      TestLogger.section('PHASE 1: TENANT ONBOARDING');
      const onboardingTest = new OnboardingTest();
      this.results.onboarding = await onboardingTest.run();
      
      if (!this.results.onboarding.success) {
        console.log('\n❌ ONBOARDING FAILED - Stopping test suite');
        return this.generateFinalReport();
      }
      
      // Wait for onboarding to complete
      TestLogger.info('Waiting 5 seconds for background processing...');
      await TestUtils.wait(5000);
      
      // Phase 2: Authentication
      TestLogger.section('PHASE 2: AUTHENTICATION');
      const authTest = new AuthTest();
      this.results.auth = await authTest.run();
      
      if (!this.results.auth.success) {
        console.log('\n❌ AUTHENTICATION FAILED - Stopping test suite');
        return this.generateFinalReport();
      }
      
      // Phase 3: API Testing
      TestLogger.section('PHASE 3: API TEST SUITE');
      const apiTest = new TenantAPITest();
      this.results.api = await apiTest.run();
      
      // Phase 4: Database Verification
      TestLogger.section('PHASE 4: DATABASE VERIFICATION');
      const dbVerification = new DatabaseVerification();
      this.results.database = await dbVerification.run();
      
      // Phase 5: Hidden Issue Detection
      TestLogger.section('PHASE 5: HIDDEN ISSUE DETECTION');
      const hiddenDetector = new HiddenIssueDetector();
      this.results.hidden = await hiddenDetector.run();
      
      // Generate final report
      return this.generateFinalReport();
      
    } catch (error) {
      console.error('\n🚨 CRITICAL ERROR:', error.message);
      console.error(error.stack);
      
      TestUtils.recordResult(
        'Test Orchestrator',
        'FAIL',
        `Critical error: ${error.message}`,
        { stack: error.stack }
      );
      
      return this.generateFinalReport();
    }
  }
  
  generateFinalReport() {
    TEST_STATE.endTime = Date.now();
    
    TestLogger.section('E2E TEST EXECUTION COMPLETE');
    
    // Calculate overall success
    const allSuccess = 
      this.results.onboarding?.success !== false &&
      this.results.auth?.success !== false &&
      this.results.database?.success !== false;
    
    const summary = TestUtils.calculateSummary();
    
    // Print detailed results
    console.log(`\n${COLORS.bright}Test Results by Phase:${COLORS.reset}`);
    console.log(`  Onboarding:      ${this.getStatusIcon(this.results.onboarding?.success)}`);
    console.log(`  Authentication:  ${this.getStatusIcon(this.results.auth?.success)}`);
    console.log(`  API Suite:       ${this.getStatusIcon(this.results.api?.success)}`);
    console.log(`  Database:        ${this.getStatusIcon(this.results.database?.success)}`);
    console.log(`  Hidden Issues:   ${this.getStatusIcon(this.results.hidden?.critical === 0)}`);
    
    console.log(`\n${COLORS.bright}Summary Statistics:${COLORS.reset}`);
    console.log(`  Total Tests:  ${summary.total}`);
    console.log(`  ${COLORS.green}Passed: ${summary.passed}${COLORS.reset}`);
    console.log(`  ${COLORS.red}Failed: ${summary.failed}${COLORS.reset}`);
    console.log(`  ${COLORS.yellow}Warnings: ${summary.warnings}${COLORS.reset}`);
    console.log(`  Duration: ${TestUtils.formatDuration(summary.duration)}`);
    
    // Test artifacts
    console.log(`\n${COLORS.bright}Test Artifacts:${COLORS.reset}`);
    console.log(`  Test ID: ${TEST_STATE.testId}`);
    console.log(`  Business ID: ${TEST_STATE.businessId || 'N/A'}`);
    console.log(`  Schema Name: ${TEST_STATE.schemaName || 'N/A'}`);
    
    // Exit code
    const exitCode = allSuccess ? 0 : 1;
    
    console.log(`\n${COLORS.bright}Exit Code: ${exitCode}${COLORS.reset}`);
    console.log(allSuccess 
      ? `${COLORS.green}✅ ALL TESTS PASSED${COLORS.reset}` 
      : `${COLORS.red}❌ SOME TESTS FAILED${COLORS.reset}`
    );
    
    console.log('\n' + '═'.repeat(60) + '\n');
    
    return {
      success: allSuccess,
      exitCode,
      summary,
      results: this.results,
      state: TEST_STATE
    };
  }
  
  getStatusIcon(success) {
    if (success === undefined) return '⏭️  SKIPPED';
    return success ? `${COLORS.green}✅ PASS${COLORS.reset}` : `${COLORS.red}❌ FAIL${COLORS.reset}`;
  }
}

// Run if called directly
if (require.main === module) {
  const orchestrator = new E2ETestOrchestrator();
  orchestrator.run().then(result => {
    process.exit(result.exitCode);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = E2ETestOrchestrator;
