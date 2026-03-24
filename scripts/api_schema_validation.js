#!/usr/bin/env node

/**
 * API SCHEMA VALIDATION SCRIPT
 * 
 * Validates that all API controllers properly align with database schema
 * and use correct field names, required fields, and data types.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ANSI color codes for better output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function log(level, message) {
    const timestamp = new Date().toISOString();
    const color = colors[level] || colors.white;
    console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

function logSuccess(message) { log('green', `✅ ${message}`); }
function logError(message) { log('red', `❌ ${message}`); }
function logWarning(message) { log('yellow', `⚠️ ${message}`); }
function logInfo(message) { log('blue', `ℹ️ ${message}`); }
function logSection(message) { log('magenta', `\n🔍 ${message}`); }

class ApiSchemaValidator {
    constructor() {
        this.issues = [];
        this.warnings = [];
        this.controllers = {};
        this.schemaFields = {};
        this.apiFieldUsage = {};
    }

    initializeSchemaFields() {
        logSection('INITIALIZING SCHEMA FIELD MAPPINGS');
        
        // Define expected schema fields based on models and database
        this.schemaFields = {
            // User fields
            user: {
                required: ['businessId', 'name', 'email', 'password', 'role'],
                optional: ['outletId', 'phone', 'isVerified', 'isActive', 'lastLogin', 'panelType', 'status', 'salary', 'location', 'experience', 'rating', 'totalOrders', 'performance', 'tokenVersion'],
                databaseFields: {
                    businessId: 'business_id',
                    outletId: 'outlet_id',
                    password: 'password_hash',
                    isVerified: 'is_verified',
                    isActive: 'is_active',
                    lastLogin: 'last_login',
                    panelType: 'panel_type',
                    totalOrders: 'total_orders',
                    tokenVersion: 'token_version'
                }
            },
            
            // Business fields
            business: {
                required: ['name', 'email'],
                optional: ['address', 'phone', 'gstNumber', 'status', 'subscription_plan', 'ownerId', 'businessId', 'type', 'isActive', 'settings'],
                databaseFields: {
                    gstNumber: 'gst_number',
                    subscription_plan: 'subscription_plan',
                    ownerId: 'owner_id',
                    businessId: 'business_id',
                    isActive: 'is_active'
                }
            },
            
            // Product fields
            product: {
                required: ['businessId', 'categoryId', 'name', 'price'],
                optional: ['outletId', 'productTypeId', 'isAvailable', 'description', 'image', 'currentStock'],
                databaseFields: {
                    businessId: 'business_id',
                    outletId: 'outlet_id',
                    categoryId: 'category_id',
                    productTypeId: 'product_type_id',
                    isAvailable: 'is_available',
                    currentStock: 'current_stock'
                }
            },
            
            // Order fields
            order: {
                required: ['businessId', 'outletId', 'orderNumber'],
                optional: ['customerDetails', 'tableId', 'status', 'billingSubtotal', 'billingTax', 'billingDiscount', 'billingTotal', 'paymentMethod', 'paymentStatus'],
                databaseFields: {
                    businessId: 'business_id',
                    outletId: 'outlet_id',
                    orderNumber: 'order_number',
                    customerDetails: 'customer_details',
                    tableId: 'table_id',
                    billingSubtotal: 'billing_subtotal',
                    billingTax: 'billing_tax',
                    billingDiscount: 'billing_discount',
                    billingTotal: 'billing_total',
                    paymentMethod: 'payment_method',
                    paymentStatus: 'payment_status'
                }
            },
            
            // Category fields
            category: {
                required: ['businessId', 'name'],
                optional: ['outletId', 'description', 'color', 'image', 'isEnabled', 'sortOrder'],
                databaseFields: {
                    businessId: 'business_id',
                    outletId: 'outlet_id',
                    isEnabled: 'is_enabled',
                    sortOrder: 'sort_order'
                }
            },
            
            // Outlet fields
            outlet: {
                required: ['businessId', 'name'],
                optional: ['address', 'managerUserId', 'parentOutletId', 'isHeadOffice', 'isActive'],
                databaseFields: {
                    businessId: 'business_id',
                    managerUserId: 'manager_user_id',
                    parentOutletId: 'parent_outlet_id',
                    isHeadOffice: 'is_head_office',
                    isActive: 'is_active'
                }
            },
            
            // Table fields
            table: {
                required: ['businessId', 'outletId', 'name'],
                optional: ['tableNo', 'capacity', 'areaId', 'status', 'currentOrderId', 'shape', 'currentOccupancy', 'qrCode'],
                databaseFields: {
                    businessId: 'business_id',
                    outletId: 'outlet_id',
                    tableNo: 'table_no',
                    areaId: 'area_id',
                    currentOrderId: 'current_order_id',
                    currentOccupancy: 'current_occupancy',
                    qrCode: 'qr_code'
                }
            },
            
            // Area fields (table_areas)
            area: {
                required: ['businessId', 'outletId', 'name'],
                optional: ['description', 'capacity', 'layout', 'status'],
                databaseFields: {
                    businessId: 'business_id',
                    outletId: 'outlet_id'
                }
            }
        };
        
        logSuccess('Schema field mappings initialized');
    }

    loadControllers() {
        logSection('LOADING API CONTROLLERS');
        
        const controllersPath = path.join(__dirname, '../controllers');
        
        if (!fs.existsSync(controllersPath)) {
            this.issues.push('Controllers directory not found');
            return;
        }
        
        const controllerFiles = fs.readdirSync(controllersPath)
            .filter(file => file.endsWith('.js') && !file.includes('.bak'))
            .filter(file => !file.startsWith('examples/'));
        
        for (const file of controllerFiles) {
            try {
                const filePath = path.join(controllersPath, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const controllerName = file.replace('.js', '');
                
                this.controllers[controllerName] = {
                    file,
                    content,
                    functions: this.extractFunctions(content),
                    bodyFields: this.extractBodyFields(content),
                    queryFields: this.extractQueryFields(content),
                    modelUsage: this.extractModelUsage(content)
                };
                
                logSuccess(`Loaded controller: ${controllerName}`);
            } catch (error) {
                logWarning(`Failed to load controller ${file}: ${error.message}`);
            }
        }
    }

    extractFunctions(content) {
        const functions = [];
        const functionRegex = /(?:const|function)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*{/g;
        let match;
        
        while ((match = functionRegex.exec(content)) !== null) {
            functions.push(match[1]);
        }
        
        return functions;
    }

    extractBodyFields(content) {
        const fields = new Set();
        
        // Match req.body.field patterns
        const bodyFieldRegex = /req\.body\.(\w+)/g;
        let match;
        
        while ((match = bodyFieldRegex.exec(content)) !== null) {
            fields.add(match[1]);
        }
        
        // Match destructuring patterns
        const destructuringRegex = /const\s*{\s*([^}]+)\s*}\s*=\s*req\.body/g;
        while ((match = destructuringRegex.exec(content)) !== null) {
            const destructuredFields = match[1].split(',').map(f => f.trim().split(':')[0]);
            destructuredFields.forEach(field => {
                if (field) fields.add(field);
            });
        }
        
        return Array.from(fields);
    }

    extractQueryFields(content) {
        const fields = new Set();
        
        // Match req.query.field patterns
        const queryFieldRegex = /req\.query\.(\w+)/g;
        let match;
        
        while ((match = queryFieldRegex.exec(content)) !== null) {
            fields.add(match[1]);
        }
        
        return Array.from(fields);
    }

    extractModelUsage(content) {
        const usage = {
            creates: [],
            updates: [],
            finds: [],
            destroys: []
        };
        
        // Find model operations
        const createRegex = /(\w+)\.create\s*\(/g;
        const updateRegex = /(\w+)\.update\s*\(/g;
        const findRegex = /(\w+)\.(?:findOne|findAll|findAndCountAll)\s*\(/g;
        const destroyRegex = /(\w+)\.destroy\s*\(/g;
        
        let match;
        while ((match = createRegex.exec(content)) !== null) {
            usage.creates.push(match[1]);
        }
        while ((match = updateRegex.exec(content)) !== null) {
            usage.updates.push(match[1]);
        }
        while ((match = findRegex.exec(content)) !== null) {
            usage.finds.push(match[1]);
        }
        while ((match = destroyRegex.exec(content)) !== null) {
            usage.destroys.push(match[1]);
        }
        
        return usage;
    }

    validateApiFieldUsage() {
        logSection('VALIDATING API FIELD USAGE AGAINST SCHEMA');
        
        for (const [controllerName, controller] of Object.entries(this.controllers)) {
            const entityName = this.inferEntityFromController(controllerName);
            
            if (!entityName || !this.schemaFields[entityName]) {
                continue; // Skip controllers that don't map to entities
            }
            
            const schema = this.schemaFields[entityName];
            const usedFields = [...controller.bodyFields, ...controller.queryFields];
            
            // Check each used field against schema
            for (const field of usedFields) {
                if (!schema.required.includes(field) && !schema.optional.includes(field)) {
                    this.warnings.push(`${controllerName}: Field '${field}' not defined in ${entityName} schema`);
                }
            }
            
            // Check for required fields in create operations
            if (controller.modelUsage.creates.length > 0) {
                for (const requiredField of schema.required) {
                    if (!controller.bodyFields.includes(requiredField)) {
                        this.warnings.push(`${controllerName}: Required field '${requiredField}' may not be set in create operations`);
                    }
                }
            }
        }
    }

    validateDatabaseFieldMappings() {
        logSection('VALIDATING DATABASE FIELD MAPPINGS');
        
        for (const [controllerName, controller] of Object.entries(this.controllers)) {
            const entityName = this.inferEntityFromController(controllerName);
            
            if (!entityName || !this.schemaFields[entityName]) {
                continue;
            }
            
            const schema = this.schemaFields[entityName];
            const dbFields = schema.databaseFields || {};
            
            // Check if controller uses camelCase fields that map to snake_case database fields
            for (const [camelField, snakeField] of Object.entries(dbFields)) {
                if (controller.bodyFields.includes(camelField) || controller.queryFields.includes(camelField)) {
                    // This is good - controller is using the correct camelCase field
                    logSuccess(`${controllerName}: Correctly uses ${camelField} -> ${snakeField} mapping`);
                }
            }
        }
    }

    validateModelOperations() {
        logSection('VALIDATING MODEL OPERATIONS');
        
        for (const [controllerName, controller] of Object.entries(this.controllers)) {
            const entityName = this.inferEntityFromController(controllerName);
            
            if (!entityName) {
                continue;
            }
            
            const expectedModel = entityName.charAt(0).toUpperCase() + entityName.slice(1);
            const allOperations = [
                ...controller.modelUsage.creates,
                ...controller.modelUsage.updates,
                ...controller.modelUsage.finds,
                ...controller.modelUsage.destroys
            ];
            
            // Check if operations use expected model names
            for (const modelUsed of allOperations) {
                if (modelUsed !== expectedModel && !modelUsed.includes('Config') && !modelUsed.includes('Counter')) {
                    this.warnings.push(`${controllerName}: Uses model '${modelUsed}' but expected '${expectedModel}'`);
                }
            }
        }
    }

    inferEntityFromController(controllerName) {
        const entityMap = {
            'userController': 'user',
            'businessController': 'business',
            'productController': 'product',
            'orderController': 'order',
            'categoryController': 'category',
            'outletController': 'outlet',
            'tableController': 'table',
            'areaController': 'area',
            'customerController': 'customer',
            'supplierController': 'supplier',
            'paymentController': 'payment',
            'inventoryController': 'inventory',
            'expenseController': 'expense'
        };
        
        return entityMap[controllerName];
    }

    validateArchitectureCompliance() {
        logSection('VALIDATING ARCHITECTURE COMPLIANCE');
        
        for (const [controllerName, controller] of Object.entries(this.controllers)) {
            // Check for forbidden direct model imports
            if (controller.content.includes('require("../models/') || controller.content.includes('require(\'../models/')) {
                this.issues.push(`${controllerName}: Contains direct model import - violates architecture`);
            }
            
            // Check for proper req.models usage
            if (controller.content.includes('req.models.') || controller.content.includes('req.models[')) {
                logSuccess(`${controllerName}: Uses req.models pattern correctly`);
            } else if (controller.modelUsage.creates.length > 0 || controller.modelUsage.finds.length > 0) {
                this.warnings.push(`${controllerName}: May not be using req.models pattern`);
            }
            
            // Check for proper error handling
            if (controller.content.includes('next(error)')) {
                logSuccess(`${controllerName}: Uses proper error handling`);
            } else {
                this.warnings.push(`${controllerName}: May not use proper error handling`);
            }
        }
    }

    generateReport() {
        logSection('GENERATING API SCHEMA VALIDATION REPORT');
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 API SCHEMA VALIDATION REPORT');
        console.log('='.repeat(80));
        
        console.log(`\n📈 STATISTICS:`);
        console.log(`   Controllers Analyzed: ${Object.keys(this.controllers).length}`);
        console.log(`   Schema Entities Defined: ${Object.keys(this.schemaFields).length}`);
        console.log(`   Critical Issues: ${this.issues.length}`);
        console.log(`   Warnings: ${this.warnings.length}`);
        
        if (this.issues.length > 0) {
            console.log(`\n🚨 CRITICAL ISSUES FOUND:`);
            for (let i = 0; i < this.issues.length; i++) {
                console.log(`   ${i + 1}. ${this.issues[i]}`);
            }
        }
        
        if (this.warnings.length > 0) {
            console.log(`\n⚠️ WARNINGS:`);
            for (let i = 0; i < this.warnings.length; i++) {
                console.log(`   ${i + 1}. ${this.warnings[i]}`);
            }
        }
        
        // Show controller summary
        console.log(`\n📋 CONTROLLERS ANALYZED:`);
        for (const [controllerName, controller] of Object.entries(this.controllers)) {
            const functionCount = controller.functions.length;
            const fieldCount = controller.bodyFields.length + controller.queryFields.length;
            console.log(`   ${controllerName}: ${functionCount} functions, ${fieldCount} fields used`);
        }
        
        const isProductionReady = this.issues.length === 0;
        
        console.log(`\n🔒 API SCHEMA READINESS STATUS:`);
        console.log(`   Status: ${isProductionReady ? '✅ PRODUCTION READY' : '❌ FIXES REQUIRED'}`);
        console.log(`   Architecture Compliance: ${this.issues.filter(i => i.includes('violates architecture')).length === 0 ? '✅ COMPLIANT' : '❌ VIOLATIONS'}`);
        console.log(`   Field Alignment: ${this.warnings.filter(w => w.includes('not defined in schema')).length === 0 ? '✅ ALIGNED' : '⚠️ MISALIGNMENTS'}`);
        
        console.log('\n' + '='.repeat(80));
        
        return {
            isProductionReady,
            issuesCount: this.issues.length,
            warningsCount: this.warnings.length,
            issues: this.issues,
            warnings: this.warnings,
            controllersAnalyzed: Object.keys(this.controllers).length
        };
    }
}

// Main execution
async function main() {
    const validator = new ApiSchemaValidator();
    
    try {
        validator.initializeSchemaFields();
        validator.loadControllers();
        validator.validateApiFieldUsage();
        validator.validateDatabaseFieldMappings();
        validator.validateModelOperations();
        validator.validateArchitectureCompliance();
        
        const report = validator.generateReport();
        
        // Exit with appropriate code
        process.exit(report.isProductionReady ? 0 : 1);
        
    } catch (error) {
        logError(`API schema validation failed: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = ApiSchemaValidator;
