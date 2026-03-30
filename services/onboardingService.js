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
            console.log('🔍 [OnboardingService] Step 6: Running comprehensive schema validation...');
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
                console.log(`🚨 [OnboardingService] STEP 6: Schema validation failed: ${errors.join('; ')}`);
                throw new Error(`Schema validation failed: ${errors.join('; ')}`);
            }
            console.log(`✅ [OnboardingService] STEP 6: Schema validation passed - all tables and columns present`);

            // 6. ONBOARDING COMPLETENESS VALIDATION (NEW STEP)
            console.log('🔍 [OnboardingService] Step 7: Validating onboarding completeness...');
            await this._validateOnboardingCompleteness(tenantModels, schemaName, businessId, outletId);
            console.log(`✅ [OnboardingService] STEP 7: Onboarding completeness validated`);

            // 7. ACTIVATE TENANT
            console.log('✅ [ONBOARDING] Step 8: Activating tenant...');
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

        console.log(`🔍 [OnboardingService] STEP 1: Inserting default data for ${schemaName}`);
        
        if (!models || typeof models !== 'object') {
            console.error('[OnboardingService] 🚨 CRITICAL: Models object is invalid');
            return { records: [], outlet: null };
        }

        try {
            console.log(`🔍 [OnboardingService] STEP 2: Creating outlet...`);
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
                console.log(`✅ [OnboardingService] STEP 2: Outlet created - ID: ${outlet.id}`);
            } else {
                console.log(`🚨 [OnboardingService] STEP 2: Outlet model not available`);
            }

            console.log(`🔍 [OnboardingService] STEP 3: Creating categories, areas, and tables...`);
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
                    }).then(c => {
                        records.push({ type: 'category', id: c.id });
                        console.log(`✅ [OnboardingService] STEP 3: Category created - ID: ${c.id}`);
                    })
                );
            }

            let mainAreaId = uuidv4();
            if (models.Area) {
                await models.Area.schema(schemaName).create({
                    id: mainAreaId,
                    businessId: businessId,
                    outletId: outletId,
                    name: 'Main Area',
                    status: 'active'
                });
                records.push({ type: 'area', id: mainAreaId });
                console.log(`✅ [OnboardingService] STEP 3: Area created - ID: ${mainAreaId}`);
            }

            // 🚨 STEP 2: ENFORCE TABLE EXISTENCE IN ONBOARDING
            if (models.Table) {
                const tableId = uuidv4();
                await models.Table.schema(schemaName).create({
                    id: tableId,
                    businessId: businessId,
                    outletId: outletId,
                    areaId: mainAreaId,
                    tableNo: 'T1',
                    name: 'Table 1',
                    capacity: 4,
                    status: 'AVAILABLE' // 🚨 STEP 3: STATUS STANDARDIZATION
                });
                records.push({ type: 'table', id: tableId });
                console.log(`✅ [OnboardingService] STEP 2: Table created - ID: ${tableId} | TableNo: T1`);
            } else {
                console.error(`🚨 [OnboardingService] STEP 2: CRITICAL - Table model not available for seeding`);
                throw new Error("Critical error: Table model not available during onboarding.");
            }

            console.log(`🔍 [OnboardingService] STEP 4: Creating inventory and products...`);
            if (models.InventoryCategory) {
                otherPromises.push(
                    models.InventoryCategory.schema(schemaName).create({
                        id: uuidv4(),
                        businessId: businessId,
                        outletId: outletId,
                        name: 'Default Inventory Category'
                    }).then(ic => {
                        records.push({ type: 'inventory_category', id: ic.id });
                        console.log(`✅ [OnboardingService] STEP 4: Inventory Category created - ID: ${ic.id}`);
                    })
                );
            }

            // Create default product
            if (models.Product) {
                const productId = uuidv4();
                await models.Product.schema(schemaName).create({
                    id: productId,
                    businessId: businessId,
                    outletId: outletId,
                    name: 'Sample Product',
                    description: 'Default product created during onboarding',
                    price: 100.00,
                    sku: 'SAMPLE-001',
                    isActive: true,
                    categoryId: records.find(r => r.type === 'category')?.id
                });
                records.push({ type: 'product', id: productId });
                console.log(`✅ [OnboardingService] STEP 4: Product created - ID: ${productId} | Name: Sample Product`);
            }

            await Promise.all(otherPromises);
            console.log(`✅ [OnboardingService] STEP 5: All default data inserted in ${Date.now() - startTime}ms`);
            console.log(`🔍 [OnboardingService] STEP 5: Created records:`, records);

        } catch (error) {
            console.error('[OnboardingService] 🚨 CRITICAL: Default data insertion error:', error.message);
            throw error;
        }

        return { records, outlet };
    }

    async _validateOnboardingCompleteness(models, schemaName, businessId, outletId) {
        console.log(`🔍 [OnboardingService] VALIDATING: Ensuring all required data exists for ${schemaName}`);
        
        const requirements = {
            outlet: { model: 'Outlet', name: 'Outlet', required: true },
            area: { model: 'Area', name: 'Area', required: true },
            table: { model: 'Table', name: 'Table', required: true },
            category: { model: 'Category', name: 'Category', required: true },
            product: { model: 'Product', name: 'Product', required: true }
        };

        const validationResults = {};

        try {
            for (const [key, config] of Object.entries(requirements)) {
                console.log(`🔍 [OnboardingService] Checking ${config.name} existence...`);
                
                if (!models[config.model]) {
                    console.log(`🚨 [OnboardingService] Model ${config.model} not available`);
                    validationResults[key] = { exists: false, count: 0, error: 'Model not available' };
                    continue;
                }

                const count = await models[config.model].schema(schemaName).count({
                    where: { businessId }
                });

                validationResults[key] = { 
                    exists: count > 0, 
                    count,
                    required: config.required 
                };

                if (config.required && count === 0) {
                    console.log(`🚨 [OnboardingService] REQUIRED ${config.name} MISSING - Count: ${count}`);
                } else {
                    console.log(`✅ [OnboardingService] ${config.name} exists - Count: ${count}`);
                }
            }

            // Check for missing required data
            const missingRequired = Object.entries(validationResults)
                .filter(([key, result]) => result.required && !result.exists)
                .map(([key]) => key);

            if (missingRequired.length > 0) {
                const errorDetails = {
                    missing: missingRequired,
                    details: validationResults,
                    businessId,
                    schemaName
                };
                
                console.log(`🚨 [OnboardingService] ONBOARDING INCOMPLETE: Missing ${missingRequired.join(', ')}`);
                throw new Error(`Onboarding incomplete: Missing required data - ${missingRequired.join(', ')}`);
            }

            console.log(`✅ [OnboardingService] ONBOARDING COMPLETE: All required data exists`);
            return { success: true, validationResults };

        } catch (error) {
            console.error(`🚨 [OnboardingService] Onboarding validation failed:`, error.message);
            throw error;
        }
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
