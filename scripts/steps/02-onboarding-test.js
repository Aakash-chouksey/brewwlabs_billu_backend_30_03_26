/**
 * STEP 2: TENANT ONBOARDING TEST
 * 
 * Triggers onboarding via OnboardingService and validates the complete flow:
 * - tenant_registry entry created with business_id, schema_name, and status = active
 * - schema created: tenant_<uuid>
 */

const colors = require('colors');
const { v4: uuidv4 } = require('uuid');
const onboardingService = require('../../services/onboardingService');

class OnboardingTest {
    static async execute(sequelize) {
        console.log(colors.cyan('  → Triggering atomic tenant onboarding...'));
        
        const testData = {
            businessName: `Validation Biz ${Date.now().toString().slice(-4)}`,
            businessEmail: `val-biz-${Date.now()}@test.com`,
            adminName: 'Validation Admin',
            adminEmail: `admin-${Date.now()}@test.com`,
            adminPassword: 'SecurePass123!',
            cafeType: 'SOLO'
        };

        const results = {
            success: true,
            businessId: null,
            schemaName: null,
            adminEmail: testData.adminEmail,
            adminPassword: testData.adminPassword,
            steps: [],
            issues: []
        };

        try {
            // Trigger onboarding service (Phase 1 + Phase 2 sync)
            console.log(colors.gray(`  → Onboarding business: ${testData.businessName}`));
            
            // Ensure models are initialized in the service context
            const { ModelFactory } = require('../../src/architecture/modelFactory');
            await ModelFactory.createModels(sequelize);

            const onboardingResult = await onboardingService.onboardBusiness(testData);

            if (!onboardingResult.success) {
                results.success = false;
                results.issues.push({
                    severity: 'CRITICAL',
                    message: `Onboarding service failed: ${onboardingResult.message}`,
                    details: onboardingResult
                });
                return results;
            }

            const { businessId, schemaName, outletId } = onboardingResult.data;
            results.businessId = businessId;
            results.schemaName = schemaName;
            results.outletId = outletId;

            console.log(colors.green(`    ✓ Onboarding service completed successfully`));
            results.steps.push({ name: 'Onboarding Execution', status: 'PASS' });

            // VALIDATION: Check tenant_registry in public schema
            console.log(colors.cyan('  → Validating tenant_registry entry...'));
            const registries = await sequelize.query(
                'SELECT * FROM public.tenant_registry WHERE business_id = :businessId',
                { replacements: { businessId }, type: sequelize.QueryTypes.SELECT }
            );
            const registry = registries[0];

            if (!registry) {
                results.success = false;
                results.issues.push({
                    severity: 'CRITICAL',
                    message: `tenant_registry entry missing for business_id: ${businessId}`
                });
            } else {
                console.log(colors.gray(`    ✓ Registry found with status: ${registry.status}`));
                
                // Validate fields as per requirement
                // Note: database might use snake_case
                const checks = [
                    { field: 'business_id', expected: businessId },
                    { field: 'schema_name', expected: schemaName },
                    { field: 'status', expected: 'ACTIVE' }
                ];

                for (const check of checks) {
                    if (registry[check.field] !== check.expected) {
                        results.success = false;
                        results.issues.push({
                            severity: 'CRITICAL',
                            message: `Inconsistent registry field: ${check.field}. Expected ${check.expected}, got ${registry[check.field]}`
                        });
                    }
                }
            }

            // VALIDATION: Check schema exists
            console.log(colors.cyan(`  → Validating schema creation: ${schemaName}...`));
            const schemaCheck = await sequelize.query(
                'SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schemaName',
                { replacements: { schemaName }, type: sequelize.QueryTypes.SELECT }
            );

            if (schemaCheck.length === 0) {
                results.success = false;
                results.issues.push({
                    severity: 'CRITICAL',
                    message: `Database schema '${schemaName}' was not created`
                });
            } else {
                console.log(colors.gray(`    ✓ Schema ${schemaName} verified in DB`));
            }

            if (results.success) {
                console.log(colors.green('  ✓ Step 2: Onboarding validation PASSED'));
                results.steps.push({ name: 'Onboarding Database Validation', status: 'PASS' });
            }

        } catch (error) {
            results.success = false;
            results.issues.push({
                severity: 'CRITICAL',
                message: `Onboarding test exception: ${error.message}`,
                stack: error.stack
            });
        }

        return results;
    }
}

module.exports = OnboardingTest;
