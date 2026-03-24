const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/unified_database');
const neonTransactionSafeExecutor = require('./neonTransactionSafeExecutor');

/**
 * Onboarding Service - FAST VERSION (<500ms)
 * Removed: model.sync() from request lifecycle - now handled by background job
 */
const onboardingService = {
    /**
     * Onboard a new business - FAST VERSION
     * ONLY: CREATE SCHEMA, INSERT business/user, REGISTER tenant, RETURN
     */
    onboardBusiness: async (data, executors) => {
        const {
            businessName, businessEmail, businessPhone, businessAddress, gstNumber,
            adminName, adminEmail, adminPassword, cafeType, brandName
        } = data;

        const businessId = uuidv4();
        const schemaName = `tenant_${businessId}`;
        const outletId = uuidv4();
        const adminId = uuidv4();
        
        const startTime = Date.now();
        let stepStart = startTime;
        
        const logStep = (stepName) => {
            const now = Date.now();
            const stepDuration = now - stepStart;
            const totalDuration = now - startTime;
            console.log(`⏱️ [ONBOARDING] ${stepName}: ${stepDuration}ms (Total: ${totalDuration}ms)`);
            stepStart = now;
        };
        
        try {
            logStep('Starting');
            
            // PHASE 1 ONLY: Control Plane Setup (Transactional)
            // Use the provided executor if available, otherwise fallback to neonTransactionSafeExecutor
            const executeInPublic = executors?.executeInPublic || 
                ((fn) => neonTransactionSafeExecutor.executeWithTenant('public', fn, { minimal: true }));
            
            logStep('Executor setup');

            const result = await executeInPublic(async (context) => {
                logStep('Transaction started');
                const { transaction, transactionModels: models } = context;
                const { Business, User, TenantRegistry } = models;
                logStep('Models extracted');

                // Check duplicates
                const [existingBusiness, existingUser] = await Promise.all([
                    Business.findOne({ where: { email: businessEmail }, transaction }),
                    User.findOne({ where: { email: adminEmail }, transaction })
                ]);
                logStep('Duplicate check completed');
                
                if (existingBusiness) throw new Error(`Business with email '${businessEmail}' already exists`);
                if (existingUser) throw new Error(`User with email '${adminEmail}' already exists`);
                
                const business = await Business.create({
                    id: businessId,
                    name: businessName,
                    email: businessEmail,
                    phone: businessPhone,
                    address: businessAddress,
                    gstNumber: gstNumber,
                    type: cafeType || 'SOLO',
                    status: 'active',
                    ownerId: adminId  // Set the admin as the owner
                }, { transaction });
                logStep('Business created');

                // CREATE SCHEMA ONLY (no table sync - that's done by background job)
                await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`, { transaction });
                logStep('Schema created');

                const hashedPass = await bcrypt.hash(adminPassword, 8); // Optimized: 8 rounds is sufficient
                logStep('Password hashed');
                
                const admin = await User.create({
                    id: adminId,
                    businessId: businessId,
                    outletId: outletId,
                    outletIds: [outletId],
                    name: adminName,
                    email: adminEmail,
                    password: hashedPass,
                    role: 'BusinessAdmin',
                    panelType: 'TENANT',
                    isActive: true,
                    isVerified: true
                }, { transaction });
                logStep('User created');

                await TenantRegistry.create({
                    id: uuidv4(),
                    businessId: businessId,
                    schemaName: schemaName,
                    status: 'pending_schema_init' // Background job will update to 'active' after schema init
                }, { transaction });
                logStep('TenantRegistry created');

                return { business, admin };
            });

            // PHASE 2: REMOVED - Model sync moved to background job
            // Background worker will: syncTenantModels(schemaName) 
            // and update TenantRegistry.status to 'active'

            const duration = Date.now() - startTime;
            console.log(`✅ Onboarding completed in ${duration}ms for ${businessEmail}`);
            console.log(`📊 ONBOARDING BREAKDOWN: ${JSON.stringify({
                businessEmail,
                totalTime: duration,
                businessId,
                schemaName
            })}`);

            return {
                success: true,
                business: result.business,
                admin: result.admin,
                businessId,
                outletId,
                schemaName,
                status: 'pending_schema_init',
                message: 'Business created. Schema initialization is running in background.',
                duration: `${duration}ms`
            };

        } catch (error) {
            // PHASE 8: Enhanced error logging
            console.error('🚨 ONBOARDING FAILED:', {
                error: error.message,
                stack: error.stack,
                businessEmail,
                adminEmail,
                errors: error.errors || null,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }
};

module.exports = onboardingService;
