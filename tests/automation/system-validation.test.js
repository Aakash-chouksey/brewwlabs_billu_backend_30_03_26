/**
 * SYSTEM VALIDATION JEST WRAPPER
 * 
 * Runs the complete automated validation suite as a Jest test.
 */

const SystemValidator = require('../../scripts/validate-system');

describe('Multi-Tenant System Validation Suite', () => {
  let validator;

  beforeAll(() => {
    validator = new SystemValidator();
  });

  test('Should pass all 11 validation steps for fresh tenant onboarding', async () => {
    console.log('🚀 Starting System Validation...');
    const results = await validator.runAll();
    
    // Assert overall pass/fail status
    expect(results.status).toBe('PASS');
    
    // Core consistency asserts
    expect(results.steps.length).toBeGreaterThanOrEqual(9);
    expect(results.issues.length).toBe(0);
    
    console.log('✅ Validation Suite completed successfully.');
  }, 300000); // 5 minute timeout for full system reset + onboarding
});
