/**
 * TENANT DATA SEEDER
 * 
 * Seeds required default data for new tenant schemas.
 * Called after schema creation and migrations complete.
 */

const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../config/unified_database');

// Production logging guard
const isProd = process.env.NODE_ENV === 'production';
const log = {
    info: (msg, ...args) => !isProd && console.log(msg, ...args),
    warn: (msg, ...args) => console.warn(msg, ...args),
    error: (msg, ...args) => console.error(msg, ...args)
};

class TenantDataSeeder {
    /**
     * Main entry point - seed all required default data
     * @param {Object} models - Tenant models bound to schema
     * @param {string} schemaName - Tenant schema name
     * @param {string} businessId - Business UUID
     * @param {string} outletId - Outlet UUID
     * @param {string} adminId - Admin user UUID
     */
    async seedTenantData(models, schemaName, businessId, outletId, adminId) {
        const startTime = Date.now();
        log.info(`🌱 [TenantDataSeeder] Starting data seeding for ${schemaName}...`);

        const results = {
            success: true,
            records: {},
            errors: []
        };

        try {
            // Validate required parameters
            if (!businessId || !outletId) {
                throw new Error('businessId and outletId are required for seeding');
            }

            // Seed in dependency order (parent tables first)
            const seedOperations = [
                { name: 'settings', fn: () => this._seedSettings(models, businessId, outletId) },
                { name: 'billingConfig', fn: () => this._seedBillingConfig(models, businessId, outletId) },
                { name: 'categories', fn: () => this._seedCategories(models, businessId, outletId) },
                { name: 'areas', fn: () => this._seedAreas(models, businessId, outletId) },
                { name: 'inventoryCategories', fn: () => this._seedInventoryCategories(models, businessId, outletId) },
                { name: 'tables', fn: () => this._seedTables(models, businessId, outletId) },
                { name: 'expenseTypes', fn: () => this._seedExpenseTypes(models, businessId, outletId) },
                { name: 'productTypes', fn: () => this._seedProductTypes(models, businessId, outletId) },
                { name: 'featureFlags', fn: () => this._seedFeatureFlags(models, businessId, outletId) }
            ];

            // Execute seed operations in sequence (some depend on others)
            for (const operation of seedOperations) {
                try {
                    const records = await operation.fn();
                    results.records[operation.name] = records;
                    log.info(`✅ [TenantDataSeeder] ${operation.name}: ${Array.isArray(records) ? records.length : 1} record(s)`);
                } catch (error) {
                    log.error(`❌ [TenantDataSeeder] ${operation.name} failed:`, error.message);
                    results.errors.push({ operation: operation.name, error: error.message });
                    // Continue with other operations - don't fail entire seeding
                }
            }

            const duration = Date.now() - startTime;
            log.info(`✅ [TenantDataSeeder] Complete in ${duration}ms`);
            
            return results;
        } catch (error) {
            log.error('🚨 [TenantDataSeeder] Critical error:', error.message);
            results.success = false;
            results.errors.push({ operation: 'main', error: error.message });
            return results;
        }
    }

    /**
     * Seed default settings - FIXED to match the correct table structure
     */
    async _seedSettings(models, businessId, outletId) {
        if (!models.Setting) return [];

        try {
            // Create a single settings record with all default values
            const record = await models.Setting.create({
                id: uuidv4(),
                businessId: businessId,
                appName: 'BrewwLabs POS',
                logoUrl: null,
                supportEmail: null,
                supportPhone: null,
                termsUrl: null,
                privacyUrl: null,
                maintenanceMode: false,
                currency: 'INR',
                timezone: 'Asia/Kolkata'
            });
            return [record];
        } catch (error) {
            log.warn('⚠️ Failed to create settings:', error.message);
            return [];
        }
    }

    /**
     * Seed default billing config
     */
    async _seedBillingConfig(models, businessId, outletId) {
        if (!models.BillingConfig) return [];

        try {
            const record = await models.BillingConfig.create({
                id: uuidv4(),
                businessId,
                outletId,
                taxRate: 5.0,
                currency: 'INR',
                roundOffEnabled: true,
                serviceChargeEnabled: false,
                serviceChargeRate: 0
            });
            return [record];
        } catch (error) {
            log.warn('⚠️ Failed to create billing config:', error.message);
            return [];
        }
    }

    /**
     * Seed default categories (at least one required for products)
     */
    async _seedCategories(models, businessId, outletId) {
        if (!models.Category) return [];

        const defaultCategories = [
            { name: 'Beverages', color: '#3B82F6', description: 'Hot and cold beverages', sortOrder: 1 },
            { name: 'Food', color: '#10B981', description: 'Main course and snacks', sortOrder: 2 },
            { name: 'Desserts', color: '#F59E0B', description: 'Sweet treats', sortOrder: 3 },
            { name: 'Other', color: '#6B7280', description: 'Miscellaneous items', sortOrder: 99 }
        ];

        const records = [];
        for (const cat of defaultCategories) {
            try {
                const record = await models.Category.create({
                    id: uuidv4(),
                    businessId,
                    outletId,
                    name: cat.name,
                    description: cat.description,
                    color: cat.color,
                    isEnabled: true,
                    sortOrder: cat.sortOrder
                });
                records.push(record);
            } catch (error) {
                log.warn(`⚠️ Failed to create category ${cat.name}:`, error.message);
            }
        }
        return records;
    }

    /**
     * Seed default areas (for table management)
     */
    async _seedAreas(models, businessId, outletId) {
        if (!models.Area) return [];

        const defaultAreas = [
            { name: 'Main Hall', capacity: 50, layout: 'square', description: 'Primary dining area' },
            { name: 'Outdoor', capacity: 20, layout: 'mixed', description: 'Outdoor seating' },
            { name: 'Private', capacity: 15, layout: 'square', description: 'Private dining room' }
        ];

        const records = [];
        for (const area of defaultAreas) {
            try {
                const record = await models.Area.create({
                    id: uuidv4(),
                    businessId,
                    outletId,
                    name: area.name,
                    description: area.description,
                    capacity: area.capacity,
                    layout: area.layout,
                    status: 'active'
                });
                records.push(record);
            } catch (error) {
                log.warn(`⚠️ Failed to create area ${area.name}:`, error.message);
            }
        }
        return records;
    }

    /**
     * Seed default inventory categories
     */
    async _seedInventoryCategories(models, businessId, outletId) {
        if (!models.InventoryCategory) return [];

        const defaultCategories = [
            { name: 'Raw Materials' },
            { name: 'Packaging' },
            { name: 'Consumables' },
            { name: 'Cleaning Supplies' }
        ];

        const records = [];
        for (const cat of defaultCategories) {
            try {
                const record = await models.InventoryCategory.create({
                    id: uuidv4(),
                    businessId,
                    outletId,
                    name: cat.name,
                    isActive: true
                });
                records.push(record);
            } catch (error) {
                log.warn(`⚠️ Failed to create inventory category ${cat.name}:`, error.message);
            }
        }
        return records;
    }

    /**
     * Seed default tables
     */
    async _seedTables(models, businessId, outletId) {
        if (!models.Table) return [];

        // Get first area for table assignment
        let areaId = null;
        try {
            const firstArea = await models.Area.findOne({
                where: { businessId, outletId },
                order: [['created_at', 'ASC']]
            });
            if (firstArea) areaId = firstArea.id;
        } catch (error) {
            log.warn('⚠️ Could not find area for table assignment:', error.message);
        }

        const defaultTables = [];
        // Create T1-T10
        for (let i = 1; i <= 10; i++) {
            defaultTables.push({
                name: `Table ${i}`,
                tableNo: `T${i}`,
                capacity: i <= 4 ? 4 : (i <= 8 ? 6 : 8),
                status: 'AVAILABLE',
                shape: i % 3 === 0 ? 'round' : 'square'
            });
        }

        const records = [];
        for (const table of defaultTables) {
            try {
                const record = await models.Table.create({
                    id: uuidv4(),
                    businessId,
                    outletId,
                    areaId,
                    name: table.name,
                    tableNo: table.tableNo,
                    capacity: table.capacity,
                    status: table.status,
                    shape: table.shape,
                    currentOccupancy: 0
                });
                records.push(record);
            } catch (error) {
                log.warn(`⚠️ Failed to create table ${table.name}:`, error.message);
            }
        }
        return records;
    }

    /**
     * Seed default expense types
     */
    async _seedExpenseTypes(models, businessId, outletId) {
        if (!models.ExpenseType) return [];

        const defaultTypes = [
            { name: 'Rent', description: 'Monthly rental expense' },
            { name: 'Utilities', description: 'Electricity, water, gas' },
            { name: 'Salaries', description: 'Staff salaries and wages' },
            { name: 'Maintenance', description: 'Equipment and facility maintenance' },
            { name: 'Supplies', description: 'Office and operational supplies' },
            { name: 'Marketing', description: 'Advertising and promotions' }
        ];

        const records = [];
        for (const type of defaultTypes) {
            try {
                const record = await models.ExpenseType.create({
                    id: uuidv4(),
                    businessId,
                    outletId,
                    name: type.name,
                    description: type.description,
                    isActive: true
                });
                records.push(record);
            } catch (error) {
                log.warn(`⚠️ Failed to create expense type ${type.name}:`, error.message);
            }
        }
        return records;
    }

    /**
     * Seed default product types
     */
    async _seedProductTypes(models, businessId, outletId) {
        if (!models.ProductType) return [];

        const defaultTypes = [
            { name: 'Veg', description: 'Vegetarian items' },
            { name: 'Non-Veg', description: 'Non-vegetarian items' },
            { name: 'Vegan', description: 'Vegan items' },
            { name: 'Beverage', description: 'Drinks and beverages' }
        ];

        const records = [];
        for (const type of defaultTypes) {
            try {
                const record = await models.ProductType.create({
                    id: uuidv4(),
                    businessId,
                    outletId,
                    name: type.name,
                    description: type.description
                });
                records.push(record);
            } catch (error) {
                log.warn(`⚠️ Failed to create product type ${type.name}:`, error.message);
            }
        }
        return records;
    }

    /**
     * Seed default feature flags
     */
    async _seedFeatureFlags(models, businessId, outletId) {
        if (!models.FeatureFlag) return [];

        const defaultFlags = [
            { feature: 'table_management', enabled: true },
            { feature: 'inventory_management', enabled: true },
            { feature: 'customer_management', enabled: true },
            { feature: 'recipe_management', enabled: false },
            { feature: 'advanced_reporting', enabled: false },
            { feature: 'multi_outlet', enabled: false },
            { feature: 'online_ordering', enabled: false },
            { feature: 'loyalty_program', enabled: false }
        ];

        const records = [];
        for (const flag of defaultFlags) {
            try {
                const record = await models.FeatureFlag.create({
                    id: uuidv4(),
                    businessId,
                    outletId,
                    feature: flag.feature,
                    enabled: flag.enabled,
                    config: {}
                });
                records.push(record);
            } catch (error) {
                log.warn(`⚠️ Failed to create feature flag ${flag.feature}:`, error.message);
            }
        }
        return records;
    }

    /**
     * Verify that required data exists in tenant schema
     * Called before marking tenant as ACTIVE
     */
    async verifyRequiredData(models, schemaName, businessId, outletId) {
        const checks = {
            settings: { required: false, exists: false },
            categories: { required: true, exists: false, minCount: 1 },
            areas: { required: false, exists: false },
            tables: { required: false, exists: false },
            inventoryCategories: { required: false, exists: false },
            billingConfig: { required: false, exists: false }
        };

        const errors = [];

        try {
            // Check settings
            if (models.Setting) {
                const settingsCount = await models.Setting.count({ where: { businessId } });
                checks.settings.exists = settingsCount > 0;
            }

            // Check categories (REQUIRED - products can't be created without categories)
            if (models.Category) {
                const catCount = await models.Category.count({ where: { businessId, outletId } });
                checks.categories.exists = catCount >= checks.categories.minCount;
                if (checks.categories.required && !checks.categories.exists) {
                    errors.push(`At least ${checks.categories.minCount} category is required`);
                }
            }

            // Check areas
            if (models.Area) {
                const areaCount = await models.Area.count({ where: { businessId, outletId } });
                checks.areas.exists = areaCount > 0;
            }

            // Check tables
            if (models.Table) {
                const tableCount = await models.Table.count({ where: { businessId, outletId } });
                checks.tables.exists = tableCount > 0;
            }

            // Check inventory categories
            if (models.InventoryCategory) {
                const invCatCount = await models.InventoryCategory.count({ where: { businessId, outletId } });
                checks.inventoryCategories.exists = invCatCount > 0;
            }

            // Check billing config
            if (models.BillingConfig) {
                const billingCount = await models.BillingConfig.count({ where: { businessId, outletId } });
                checks.billingConfig.exists = billingCount > 0;
            }

            return {
                valid: errors.length === 0,
                checks,
                errors
            };
        } catch (error) {
            return {
                valid: false,
                checks,
                errors: [...errors, `Verification error: ${error.message}`]
            };
        }
    }
}

module.exports = new TenantDataSeeder();
