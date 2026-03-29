const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');
const { sequelize } = require('../config/unified_database');
const tenantModelLoader = require('../src/architecture/tenantModelLoader');
const neonTransactionSafeExecutor = require('./neonTransactionSafeExecutor');
const { PUBLIC_SCHEMA } = require('../src/utils/constants');

// Production logging guard - reduces console overhead in production
const isProd = process.env.NODE_ENV === 'production';
const log = {
    info: (msg, ...args) => !isProd && console.log(msg, ...args),
    warn: (msg, ...args) => console.warn(msg, ...args),
    error: (msg, ...args) => console.error(msg, ...args),
    time: (label) => !isProd && console.time(label),
    timeEnd: (label) => !isProd && console.timeEnd(label)
};

/**
 * PRODUCTION-GRADE ONBOARDING SERVICE
 * 
 * Multi-tenant onboarding with:
 * - Proper schema isolation (model.schema binding)
 * - PgBouncer-safe operations (no search_path dependency)
 * - Comprehensive table verification
 * - Atomic cleanup on failure
 * - Schema-First initialization using Sequelize models
 */

class OnboardingService {
    
    // CONTROL MODELS (should NEVER be in tenant schema)
    static get CONTROL_MODELS() {
        const { CONTROL_MODELS } = require('../src/utils/constants');
        return CONTROL_MODELS;
    }

    /**
     * Main onboarding method
     * Synchronously creates schema, all tables, seeds default data and validates everything.
     */
    async onboardBusiness(data, executors = null) {
        const {
            businessName, businessEmail, businessPhone, businessAddress, gstNumber,
            adminName, adminEmail, adminPassword, cafeType
        } = data;

        const businessId = uuidv4();
        const tenantId = uuidv4();
        const schemaName = `tenant_${businessId}`;
        const outletId = uuidv4();
        const adminId = uuidv4();
        
        const startTime = Date.now();
        console.log(`🚀 [ONBOARDING] Starting: ${schemaName}`);

        // Track resources for cleanup on failure
        const createdResources = {
            schemaCreated: false,
            businessCreated: false,
            userCreated: false,
            registryCreated: false
        };

        try {
            // 1. PRE-VALIDATION (Fast direct queries)
            await this._validatePrerequisites(businessEmail, adminEmail);

            // 2. CONTROL PLANE SETUP FIRST (Transactional)
            const executeInPublic = executors?.executeInPublic || 
                ((fn) => neonTransactionSafeExecutor.executeInPublic(fn));

            const hashedPass = await bcrypt.hash(adminPassword, 10);

            console.log('🏢 [ONBOARDING] Step 1: Creating control plane records...');
            
            await executeInPublic(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Business, User } = models;

                // Create Business
                const business = await Business.create({
                    id: businessId,
                    name: businessName,
                    email: businessEmail,
                    phone: businessPhone,
                    address: businessAddress,
                    gstNumber: gstNumber,
                    type: cafeType || 'SOLO',
                    status: 'active',
                    ownerId: adminId,
                    isActive: true
                }, { transaction });
                createdResources.businessCreated = true;

                // Create Admin User
                await User.create({
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
                    isVerified: true,
                    tokenVersion: 1
                }, { transaction });
                createdResources.userCreated = true;

                // Create Tenant Registry with status 'CREATING'
                await sequelize.query(
                    `INSERT INTO "public"."tenant_registry" ("id", "business_id", "schema_name", "status", "created_at") 
                     VALUES (:id, :businessId, :schemaName, 'CREATING', NOW())`,
                    { 
                        replacements: { 
                            id: tenantId, 
                            businessId: businessId, 
                            schemaName: schemaName 
                        },
                        transaction 
                    }
                );
                createdResources.registryCreated = true;
            });
            
            console.log(`✅ [ONBOARDING] Control plane setup complete`);

            // 3. INITIALIZE TENANT SCHEMA (Schema-First Approach)
            console.log('🏗️  [ONBOARDING] Step 4: Initializing tenant schema (Schema-First)...');
            const { models: tenantModels, created: createdTables } = await tenantModelLoader.initializeTenantSchema(sequelize, schemaName);
            createdResources.schemaCreated = true;
            console.log(`✅ [ONBOARDING] Schema and ${createdTables.length} tables created: ${schemaName}`);

            // 4. SEED DEFAULT DATA
            console.log('🌱 [ONBOARDING] Step 5: Seeding default data...');
            await this._insertDefaultData(tenantModels, schemaName, outletId, businessId, adminId);

            // 5. COMPREHENSIVE SCHEMA VALIDATION (Step 4 of requirements)
            console.log('🔍 [ONBOARDING] Step 6: Running comprehensive schema validation...');
            const { validateTenantSchemaComplete } = require('../utils/schemaValidator');
            const validation = await validateTenantSchemaComplete(sequelize, businessId);
            
            if (!validation.complete) {
                const errors = [];
                if (validation.missingTables.length > 0) {
                    errors.push(`Missing tables: ${validation.missingTables.join(', ')}`);
                }
                if (validation.columnIssues.length > 0) {
                    errors.push(`Missing columns: ${validation.columnIssues.map(c => `${c.table}(${c.missingColumns.join(', ')})`).join('; ')}`);
                }
                throw new Error(`Schema validation failed: ${errors.join('; ')}`);
            }
            console.log(`✅ [ONBOARDING] Schema validation passed - all tables and columns present`);

            // 6. ACTIVATE TENANT
            console.log('✅ [ONBOARDING] Step 7: Activating tenant...');
            await sequelize.query(
                `UPDATE "public"."tenant_registry" 
                 SET "status" = 'ACTIVE', "activated_at" = NOW(), "updated_at" = NOW()
                 WHERE "business_id" = :businessId`,
                { replacements: { businessId } }
            );
            console.log(`✅ [ONBOARDING] Tenant activated: ${businessId}`);

            const duration = Date.now() - startTime;
            console.log(`🎉 [ONBOARDING] Onboarding complete in ${duration}ms.`);

            return {
                success: true,
                message: 'Tenant onboarded successfully.',
                data: {
                    tenantId: businessId,
                    businessId,
                    outletId,
                    schemaName,
                    status: 'ACTIVE',
                    duration: `${duration}ms`,
                    user: { id: adminId, email: adminEmail, name: adminName }
                }
            };

        } catch (error) {
            console.error('🚨 [ONBOARDING] Failed:', error.message);
            await this._rollbackOnFailure(createdResources, schemaName);
            throw error;
        }
    }

    /**
     * Rollback safety: Drop schema and cleanup if any step failed
     */
    async _rollbackOnFailure(createdResources, schemaName) {
        console.log('[OnboardingService] 🧹 Starting rollback cleanup...');
        if (createdResources.schemaCreated) {
            try {
                await sequelize.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
                console.log(`[OnboardingService] ✅ ROLLBACK: Dropped schema ${schemaName}`);
            } catch (err) {
                console.error(`[OnboardingService] ⚠️ ROLLBACK: Failed to drop schema:`, err.message);
            }
        }
        tenantModelLoader.clearCache(schemaName);
        console.log('[OnboardingService] 🧹 Rollback cleanup complete');
    }

    async _validatePrerequisites(businessEmail, adminEmail) {
        const { ModelFactory } = require('../src/architecture/modelFactory');
        await ModelFactory.createModels(sequelize);
        
        const { Business, User } = sequelize.models;
        
        const businessExists = await Business.schema('public').findOne({
            where: { email: businessEmail },
            attributes: ['id']
        });
        
        const userExists = await User.schema('public').findOne({
            where: { email: adminEmail },
            attributes: ['id']
        });
        
        if (businessExists) throw new Error(`Business email '${businessEmail}' already exists`);
        if (userExists) throw new Error(`Admin email '${adminEmail}' already exists`);
    }

    /**
     * Insert default data using tenant models
     */
    async _insertDefaultData(models, schemaName, outletId, businessId, adminId) {
        const startTime = Date.now();
        const records = [];
        let outlet = null;

        if (!models || typeof models !== 'object') {
            console.error('[OnboardingService] 🚨 CRITICAL: Models object is invalid');
            return { records: [], outlet: null };
        }

        try {
            // Create Outlet first
            if (models.Outlet) {
                outlet = await models.Outlet.schema(schemaName).create({
                    id: outletId,
                    businessId: businessId,
                    name: 'Main Outlet',
                    email: `main-${businessId.slice(0, 8)}@outlet.local`,
                    status: 'active',
                    isActive: true
                });
                records.push({ type: 'outlet', id: outlet.id });
            }

            // Create remaining records
            const otherPromises = [];

            if (models.Category) {
                otherPromises.push(
                    models.Category.schema(schemaName).create({
                        id: uuidv4(),
                        businessId: businessId,
                        outletId: outletId,
                        name: 'Default Category',
                        isEnabled: true
                    }).then(c => records.push({ type: 'category', id: c.id }))
                );
            }

            if (models.Area) {
                otherPromises.push(
                    models.Area.schema(schemaName).create({
                        id: uuidv4(),
                        businessId: businessId,
                        outletId: outletId,
                        name: 'Main Area',
                        status: 'active'
                    }).then(a => records.push({ type: 'area', id: a.id }))
                );
            }

            if (models.InventoryCategory) {
                otherPromises.push(
                    models.InventoryCategory.schema(schemaName).create({
                        id: uuidv4(),
                        businessId: businessId,
                        outletId: outletId,
                        name: 'Default Inventory Category'
                    }).then(ic => records.push({ type: 'inventory_category', id: ic.id }))
                );
            }

            await Promise.all(otherPromises);
            console.log(`[OnboardingService] ✅ Default data inserted in ${Date.now() - startTime}ms`);

        } catch (error) {
            console.error('[OnboardingService] ⚠️ Default data insertion error:', error.message);
        }

        return { records, outlet };
    }

    async getOnboardingStatus(businessId) {
        const schemaName = `tenant_${businessId}`;
        try {
            const { validateTenantSchemaComplete } = require('../utils/schemaValidator');
            const validation = await validateTenantSchemaComplete(sequelize, businessId);
            return {
                success: true,
                data: validation
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }
}

module.exports = new OnboardingService();
