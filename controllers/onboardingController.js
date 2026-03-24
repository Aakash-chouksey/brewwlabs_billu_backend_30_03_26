const onboardingService = require('../services/onboarding.service');
const authService = require('../services/auth.service');
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
                executeInPublic: (fn) => neonTransactionSafeExecutor.executeWithTenant('public', fn, { minimal: true }),
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

            const accessToken = authService.generateAccessToken(result.admin);
            const refreshToken = authService.generateRefreshToken(result.admin);

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
                hasBusiness: !!result.business,
                hasOutlet: !!result.outlet,
                hasUser: !!result.admin,
                hasAccessToken: !!accessToken,
                hasRefreshToken: !!refreshToken
            });

            const responseData = {
                success: true,
                message: 'Business onboarded successfully.',
                business: result.business ? result.business.get({ plain: true }) : null,
                outlet: result.outlet ? result.outlet.get({ plain: true }) : null,
                user: result.admin ? result.admin.get({ plain: true }) : null,
                accessToken,
                refreshToken
            };
            
            console.log('🔍 [ONBOARDING] Full response:', JSON.stringify(responseData, null, 2));

            return res.status(201).json(responseData);

        } catch (error) {
            // Handle duplicate errors with 409 status
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
