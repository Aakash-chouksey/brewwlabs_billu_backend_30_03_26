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
            const accessToken = authService.generateAccessToken(data.user);
            const refreshToken = authService.generateRefreshToken(data.user);

            const cookieOptions = {
                httpOnly: true,
                secure: config.nodeEnv === 'production',
                sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
                path: '/'
            };

            res.cookie('accessToken', accessToken, {
                ...cookieOptions,
                maxAge: 60 * 60 * 1000
            });

            res.cookie('refreshToken', refreshToken, {
                ...cookieOptions,
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            console.log('🔍 [ONBOARDING] Response data before sending:', {
                success: true,
                hasBusiness: !!data.business,
                hasOutlet: !!data.outlet,
                hasUser: !!data.user,
                hasAccessToken: !!accessToken,
                hasRefreshToken: !!refreshToken
            });

            const responseData = {
                success: true,
                message: 'Business onboarded successfully.',
                business: data.business && typeof data.business.get === 'function' ? data.business.get({ plain: true }) : data.business,
                outlet: data.outlet && typeof data.outlet.get === 'function' ? data.outlet.get({ plain: true }) : data.outlet,
                user: data.user && typeof data.user.get === 'function' ? data.user.get({ plain: true }) : data.user,
                accessToken,
                refreshToken
            };
            
            console.log('🔍 [ONBOARDING] Full response:', JSON.stringify(responseData, null, 2));

            return res.status(201).json(responseData);

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