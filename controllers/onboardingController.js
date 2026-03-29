const onboardingService = require('../services/onboardingService');
const authService = require('../services/authService');
const config = require('../config/config');

/**
 * Onboarding Controller - Neon-Safe Version
 * Standardized for transaction-scoped service execution
 */
const onboardingController = {
    onboardBusiness: async (req, res, next) => {
        try {
            const onboardingData = req.body;

            const businessName = onboardingData.businessName || onboardingData.name;
            const businessEmail = onboardingData.businessEmail || onboardingData.email;
            const adminName = onboardingData.adminName || onboardingData.name || 'Admin';
            const adminEmail = onboardingData.adminEmail || onboardingData.email;
            const adminPassword = onboardingData.adminPassword || onboardingData.password;

            if (!businessName || !businessEmail || !adminName || !adminEmail || !adminPassword) {
                const err = new Error('Missing required fields');
                err.status = 400;
                throw err;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(businessEmail) || !emailRegex.test(adminEmail)) {
                const err = new Error('Invalid email format');
                err.status = 400;
                throw err;
            }

            // Inject executors from request context (standardized pattern)
            const neonTransactionSafeExecutor = require('../services/neonTransactionSafeExecutor');
            const executors = {
                executeInPublic: (fn) => neonTransactionSafeExecutor.executeInPublic(fn),
                executeWithTenant: (tenantId, fn) => neonTransactionSafeExecutor.executeWithTenant(tenantId, fn),
                executeWithoutTransaction: (tenantId, fn) => neonTransactionSafeExecutor.readWithTenant(tenantId, fn)
            };

            const result = await onboardingService.onboardBusiness({
                ...onboardingData,
                businessName,
                businessEmail,
                adminName,
                adminEmail,
                adminPassword
            }, executors);

            console.log('[CONTROLLER DEBUG] onboarding result:', JSON.stringify(result, null, 2).substring(0, 500));

            // Service returns data nested under 'data' property
            if (!result || !result.success || !result.data) {
                console.error("🚨 INVALID EXECUTOR RESPONSE:", result);
                throw new Error("Invalid onboarding response: onboarding failed");
            }

            const data = result.data;
            
            console.log('🔍 [ONBOARDING] Phase 1 Response data:', {
                success: true,
                tenantId: data.tenantId,
                status: 'PENDING'
            });

            return res.status(201).json({
                success: true,
                message: "Tenant created. Setup in progress.",
                tenantId: data.tenantId,
                status: 'PENDING'
            });

        } catch (error) {
            if (error.message && (
                error.message.includes('already exists') ||
                error.message.includes('duplicate')
            )) {
                error.status = 409;
            }
            return next(error);
        }
    }
};

module.exports = onboardingController;