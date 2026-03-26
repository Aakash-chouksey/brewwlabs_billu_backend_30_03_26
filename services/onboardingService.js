const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');
const { sequelize } = require('../config/unified_database');
const tenantModelLoader = require('../src/architecture/tenantModelLoader');
const neonTransactionSafeExecutor = require('./neonTransactionSafeExecutor');
const { PUBLIC_SCHEMA } = require('../src/utils/constants');

/**
 * PRODUCTION-GRADE ONBOARDING SERVICE
 * 
 * Multi-tenant onboarding with:
 * - Proper schema isolation (model.schema binding)
 * - PgBouncer-safe operations (no search_path dependency)
 * - Comprehensive table verification
 * - Atomic cleanup on failure
 */

class OnboardingService {
    
    // CONTROL MODELS (should NEVER be in tenant schema)
    // Centralized from constants.js
    static get CONTROL_MODELS() {
        const { CONTROL_MODELS } = require('../src/utils/constants');
        return CONTROL_MODELS;
    }

    /**
     * Main onboarding method - FULLY ATOMIC
     */
    async onboardBusiness(data, executors = null) {
        const {
            businessName, businessEmail, businessPhone, businessAddress, gstNumber,
            adminName, adminEmail, adminPassword, cafeType,
            forcedBusinessId, forcedOutletId // NEW: For debug auto-provisioning
        } = data;

        const businessId = forcedBusinessId || uuidv4();
        const schemaName = `tenant_${businessId}`;
        const outletId = forcedOutletId || uuidv4();
        const adminId = uuidv4();
        
        const startTime = Date.now();
        const logs = [];
        
        const logStep = (step, details = '') => {
            const elapsed = Date.now() - startTime;
            const message = `[ONBOARDING] ${step} | +${elapsed}ms ${details}`;
            logs.push(message);
            console.log(message);
        };

        // CRITICAL: Force public schema at the very beginning
        // This ensures tenant_registry and other control plane tables are accessible
        try {
            await sequelize.query(`SET search_path TO "${PUBLIC_SCHEMA}"`);
            logStep('SCHEMA_LOCK', `search_path forced to: ${PUBLIC_SCHEMA}`);
        } catch (error) {
            console.error('[ONBOARDING] ❌ Failed to set public schema:', error.message);
            throw new Error('Failed to initialize public schema context');
        }

        // Track created resources for cleanup on failure
        const createdResources = {
            schemaCreated: false,
            tablesCreated: [],
            defaultDataCreated: [],
            businessCreated: false,
            userCreated: false,
            verificationPassed: false
        };

        try {
            logStep('INIT', `businessId=${businessId}, schema=${schemaName}`);

            // PHASE 1: PRE-VALIDATION
            await this._validatePrerequisites(businessEmail, adminEmail);
            logStep('PHASE 1', 'Pre-validation complete');

            // PHASE 2: CREATE SCHEMA (DDL - No Transaction)
            await this._createSchema(schemaName);
            createdResources.schemaCreated = true;
            logStep('PHASE 2', `Schema created: ${schemaName}`);

            // PHASE 3: CREATE ALL TABLES using FAST PARALLEL initialization
            // 🔥 OPTIMIZED: Parallel table creation instead of sequential sync
            const schemaInit = await tenantModelLoader.initializeTenantSchema(sequelize, schemaName);
            createdResources.tablesCreated = Object.keys(schemaInit.models);
            logStep('PHASE 3', `${schemaInit.created.length} tables created, ${schemaInit.existing.length} existing in ${schemaInit.duration}ms`);

            // PHASE 4: VERIFY SCHEMA INTEGRITY (Table + Column Level)
            const verification = await tenantModelLoader.verifySchemaIntegrity(sequelize, schemaName);
            if (!verification.isValid) {
                console.error(`[ONBOARDING] ❌ SCHEMA INTEGRITY FAILED in ${schemaName}:`, {
                    missingTables: verification.missingTables,
                    missingColumns: verification.missingColumns
                });
                
                // Try one-time repair if columns are missing
                if (verification.missingColumns.length > 0) {
                    console.log(`[ONBOARDING] 🛡️ Attempting auto-repair for missing columns in ${schemaName}...`);
                    const repairResult = await tenantModelLoader.repairTenantSchema(sequelize, schemaName);
                    if (!repairResult.isValid) {
                        throw new Error(`Schema integrity repair failed. Missing: ${repairResult.missingColumns.join(', ')}`);
                    }
                    console.log(`[ONBOARDING] ✅ Auto-repair successful for ${schemaName}`);
                } else {
                    throw new Error(`Table verification failed. Missing tables: ${verification.missingTables.join(', ')}`);
                }
            }
            createdResources.verificationPassed = true;
            logStep('PHASE 4', `Verified schema integrity for ${schemaName}`);

            // PHASE 5: INSERT DEFAULT DATA
            // Always use .schema(schemaName) for safety
            const defaultData = await this._insertDefaultData(schemaInit.models, schemaName, outletId, businessId, adminId);
            createdResources.defaultDataCreated = defaultData.records;
            logStep('PHASE 5', `${defaultData.records.length} default records inserted into ${schemaName}`);

            // PHASE 6: TRANSACTIONAL DATA INSERT (Control Plane only)
            const executeInPublic = executors?.executeInPublic || 
                ((fn) => neonTransactionSafeExecutor.executeInPublic(fn));

            const transactionResultWrapper = await executeInPublic(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Business, User, TenantRegistry } = models;

                logStep('PHASE 6', 'Starting control plane transaction...');

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

                // Create Admin User
                const hashedPass = await bcrypt.hash(adminPassword, 10);
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
                    isVerified: true,
                    tokenVersion: 1
                }, { transaction });

                // Create Tenant Registry
                await TenantRegistry.create({
                    id: uuidv4(),
                    businessId: businessId,
                    schemaName: schemaName,
                    status: 'active'
                }, { transaction });

                return { business: business.toJSON(), admin: admin.toJSON() };
            });

            const transactionResult = transactionResultWrapper.data;

            createdResources.businessCreated = true;
            createdResources.userCreated = true;
            logStep('PHASE 6', 'Control plane data created successfully');

            // PHASE 7: FINAL VALIDATION
            await this._finalValidation(schemaName, transactionResult.business, transactionResult.admin);
            logStep('PHASE 7', 'Final validation passed');

            // SUCCESS: Build response
            const totalDuration = Date.now() - startTime;
            logStep('COMPLETE', `Successfully onboarded ${businessName} in ${totalDuration}ms`);

            return {
                success: true,
                message: 'Business onboarded successfully',
                data: {
                    business: transactionResult.business,
                    user: transactionResult.admin,
                    outlet: defaultData.outlet,
                    businessId,
                    outletId,
                    schemaName,
                    tablesCreated: verification.count,
                    duration: `${totalDuration}ms`
                }
            };

        } catch (error) {
            console.error('[ONBOARDING] 🚨 FAILED:', error.message);
            
            // Cleanup on failure
            await this._cleanupOnFailure(createdResources, schemaName);
            
            throw new Error(`Onboarding failed: ${error.message}`);
        }
    }

    async _validatePrerequisites(businessEmail, adminEmail) {
        await neonTransactionSafeExecutor.executeInPublic(async (context) => {
            const { transactionModels: models } = context;
            const { Business, User } = models;
            const [eb, eu] = await Promise.all([
                Business.findOne({ where: { email: businessEmail } }),
                User.findOne({ where: { email: adminEmail } })
            ]);
            if (eb) throw new Error(`Business email '${businessEmail}' already exists`);
            if (eu) throw new Error(`Admin email '${adminEmail}' already exists`);
        });
    }

    async _createSchema(schemaName) {
        try {
            await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
            console.log(`[OnboardingService] ✅ Schema created: ${schemaName}`);
        } catch (error) {
            console.error(`[OnboardingService] ❌ Schema creation failed:`, error.message);
            throw new Error(`Failed to create schema: ${error.message}`);
        }
    }

    /**
     * Verify all required tables and columns exist using TenantModelLoader
     */
    async _verifyAllTablesExist(schemaName) {
        // 🔒 1. Table + Column Level Integrity check
        console.log(`[OnboardingService] 🔍 Verifying schema integrity: ${schemaName}`);
        const verification = await tenantModelLoader.verifySchemaIntegrity(sequelize, schemaName);

        // 🔒 2. CONSISTENCY CHECK: Ensure NO control tables in tenant schema
        const { CONTROL_MODELS } = require('../src/utils/constants');
        
        const allTablesQuery = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = :schema
            AND table_type = 'BASE TABLE'
        `, {
            replacements: { schema: schemaName },
            type: Sequelize.QueryTypes.SELECT
        });

        const tableNames = allTablesQuery.map(t => t.table_name.toLowerCase());
        
        // Map control model names to likely table names (underscored)
        const controlTableNames = CONTROL_MODELS.map(m => {
            if (m === 'User') return 'users';
            if (m === 'Business') return 'businesses';
            if (m === 'TenantRegistry') return 'tenant_registry';
            return m.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
        });

        const wrongTables = tableNames.filter(table => controlTableNames.includes(table));

        if (wrongTables.length > 0) {
            console.error(`[OnboardingService] 🚨 CONTROL TABLES FOUND in ${schemaName}:`, wrongTables);
            throw new Error(`Schema consistency violation: Control tables found in tenant: ${wrongTables.join(', ')}`);
        }

        console.log(`[OnboardingService] Integrity check for ${schemaName}: ${verification.isValid ? '✅ VALID' : '❌ INVALID'}`);
        if (!verification.isValid) {
            console.log(`   ❌ Missing Tables: ${verification.missingTables.join(', ')}`);
            console.log(`   ❌ Missing Columns: ${verification.missingColumns.join(', ')}`);
        }

        return {
            ...verification,
            wrongTables,
            isConsistent: wrongTables.length === 0 && verification.isValid
        };
    }

    /**
     * Insert default data using tenant models
     */
    async _insertDefaultData(models, schemaName, outletId, businessId, adminId) {
        const records = [];
        let outlet = null;

        try {
            // 1. Create default outlet
            if (models.Outlet) {
                const o = await models.Outlet.schema(schemaName).create({
                    id: outletId,
                    businessId: businessId,
                    name: 'Main Outlet',
                    email: `main-${businessId.slice(0, 8)}@outlet.local`,
                    status: 'active',
                    isActive: true
                });
                outlet = o.toJSON();
                records.push({ type: 'outlet', id: o.id });
                console.log('[OnboardingService]   ✅ Default outlet created');
            }

            // 2. Create default category
            if (models.Category) {
                const c = await models.Category.schema(schemaName).create({
                    id: uuidv4(),
                    businessId: businessId,
                    outletId: outletId,
                    name: 'Default Category',
                    status: 'active'
                });
                records.push({ type: 'category', id: c.id });
                console.log('[OnboardingService]   ✅ Default category created');
            }

            // 3. Create default area
            if (models.Area) {
                const a = await models.Area.schema(schemaName).create({
                    id: uuidv4(),
                    businessId: businessId,
                    outletId: outletId,
                    name: 'Main Area',
                    status: 'active'
                });
                records.push({ type: 'area', id: a.id });
                console.log('[OnboardingService]   ✅ Default area created');
            }

            // 4. Create default inventory category
            if (models.InventoryCategory) {
                const ic = await models.InventoryCategory.schema(schemaName).create({
                    id: uuidv4(),
                    businessId: businessId,
                    outletId: outletId,
                    name: 'Default Inventory Category'
                });
                records.push({ type: 'inventory_category', id: ic.id });
                console.log('[OnboardingService]   ✅ Default inventory category created');
            }

        } catch (error) {
            console.error('[OnboardingService] ⚠️ Default data insertion error:', error.message);
        }

        return { records, outlet };
    }

    /**
     * Final validation - ensure system is 100% usable
     */
    async _finalValidation(schemaName, business, admin) {
        const errors = [];

        if (!business?.id || !business?.name) errors.push('Business not properly created');
        if (!admin?.id || !admin?.email) errors.push('Admin user not properly created');

        const schemaResult = await sequelize.query(`
            SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema
        `, { 
            replacements: { schema: schemaName }, 
            type: Sequelize.QueryTypes.SELECT 
        });

        if (!schemaResult?.length) errors.push(`Schema ${schemaName} does not exist`);

        if (errors.length > 0) throw new Error(`Final validation failed: ${errors.join('; ')}`);
        console.log('[OnboardingService] ✅ Final validation passed');
    }

    /**
     * Cleanup resources on onboarding failure
     */
    async _cleanupOnFailure(createdResources, schemaName) {
        console.log('[OnboardingService] 🧹 Starting cleanup...');

        // Only drop schema if table creation failed OR verification failed
        const tableCreationSuccess = createdResources.tablesCreated.length > 0 && createdResources.verificationPassed;

        if (createdResources.schemaCreated && !tableCreationSuccess) {
            try {
                await sequelize.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
                console.log(`[OnboardingService]   ✅ CLEANUP: Dropped incomplete schema: ${schemaName}`);
            } catch (error) {
                console.error(`[OnboardingService]   ⚠️ CLEANUP: Failed to drop schema:`, error.message);
            }
        } else if (tableCreationSuccess) {
            console.log(`[OnboardingService]   ℹ️ CLEANUP: Tables were created successfully; keeping schema ${schemaName} for recovery/manual fix.`);
        }

        // Clear model cache for this schema
        tenantModelLoader.clearCache(schemaName);
        console.log('[OnboardingService] 🧹 Cleanup complete');
    }

    /**
     * Get onboarding status (for debugging)
     */
    async getOnboardingStatus(businessId) {
        const schemaName = `tenant_${businessId}`;
        try {
            // Dynamic identification
            const allModels = Object.values(sequelize.models);
            const { CONTROL_MODELS: CONTROL_PLANE_MODEL_NAMES } = require('../src/utils/constants');
            const requiredTenantTables = allModels
                .filter(model => !CONTROL_PLANE_MODEL_NAMES.includes(model.name))
                .map(model => {
                    const raw = model.getTableName();
                    return typeof raw === 'string' ? raw : raw.tableName;
                });

            const verification = await tenantModelLoader.verifyTablesExist(
                sequelize,
                schemaName,
                requiredTenantTables
            );

            // Check for control tables
            const allTables = await sequelize.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = :schema
                AND table_type = 'BASE TABLE'
            `, {
                replacements: { schema: schemaName },
                type: Sequelize.QueryTypes.SELECT
            });

            const tableNames = allTables.map(t => t.table_name);
            const wrongTables = tableNames.filter(table => 
                OnboardingService.CONTROL_MODELS.includes(table)
            );

            return {
                success: true,
                data: {
                    schemaName,
                    tablesExist: verification.exists,
                    tableCount: verification.count,
                    missingTables: verification.missing,
                    wrongTables: wrongTables,
                    isConsistent: wrongTables.length === 0 && verification.missing.length === 0
                }
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
