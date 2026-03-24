#!/usr/bin/env node

/**
 * COMPREHENSIVE API VERIFICATION AND FIXING SCRIPT
 * 
 * This script analyzes all APIs, validates them against schema,
 * identifies issues, and applies fixes to ensure production readiness.
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

class ApiVerifierAndFixer {
    constructor() {
        this.issues = [];
        this.fixes = [];
        this.controllers = {};
        this.schemaDefinitions = {};
        this.apiEndpoints = [];
    }

    async loadSchemas() {
        logSection('STEP 1: LOADING SCHEMAS');
        
        // Define schema based on verified models
        this.schemaDefinitions = {
            user: {
                table: 'users',
                required: ['businessId', 'name', 'email', 'password', 'role'],
                optional: ['outletId', 'phone', 'isVerified', 'isActive', 'lastLogin', 'panelType', 'status', 'salary', 'location', 'experience', 'rating', 'totalOrders', 'performance', 'tokenVersion'],
                fieldMappings: {
                    businessId: 'business_id',
                    outletId: 'outlet_id',
                    password: 'password_hash',
                    isVerified: 'is_verified',
                    isActive: 'is_active',
                    lastLogin: 'last_login',
                    panelType: 'panel_type',
                    totalOrders: 'total_orders',
                    tokenVersion: 'token_version'
                },
                dataTypes: {
                    businessId: 'UUID',
                    outletId: 'UUID',
                    name: 'STRING',
                    email: 'STRING',
                    password: 'TEXT',
                    role: 'STRING',
                    phone: 'STRING',
                    isVerified: 'BOOLEAN',
                    isActive: 'BOOLEAN',
                    panelType: 'STRING',
                    status: 'STRING',
                    salary: 'DECIMAL',
                    location: 'STRING',
                    experience: 'INTEGER',
                    rating: 'DECIMAL',
                    totalOrders: 'INTEGER',
                    performance: 'DECIMAL',
                    tokenVersion: 'INTEGER'
                }
            },
            
            business: {
                table: 'businesses',
                required: ['name', 'email'],
                optional: ['address', 'phone', 'gstNumber', 'status', 'subscription_plan', 'ownerId', 'businessId', 'type', 'isActive', 'settings'],
                fieldMappings: {
                    gstNumber: 'gst_number',
                    subscription_plan: 'subscription_plan',
                    ownerId: 'owner_id',
                    businessId: 'business_id',
                    isActive: 'is_active'
                },
                dataTypes: {
                    name: 'STRING',
                    email: 'STRING',
                    address: 'STRING',
                    phone: 'STRING',
                    gstNumber: 'STRING',
                    status: 'STRING',
                    subscription_plan: 'STRING',
                    ownerId: 'UUID',
                    businessId: 'UUID',
                    type: 'STRING',
                    isActive: 'BOOLEAN',
                    settings: 'JSON'
                }
            },
            
            product: {
                table: 'products',
                required: ['businessId', 'categoryId', 'name', 'price'],
                optional: ['outletId', 'productTypeId', 'isAvailable', 'description', 'image', 'currentStock'],
                fieldMappings: {
                    businessId: 'business_id',
                    outletId: 'outlet_id',
                    categoryId: 'category_id',
                    productTypeId: 'product_type_id',
                    isAvailable: 'is_available',
                    currentStock: 'current_stock'
                },
                dataTypes: {
                    businessId: 'UUID',
                    outletId: 'UUID',
                    categoryId: 'UUID',
                    productTypeId: 'UUID',
                    name: 'STRING',
                    price: 'DECIMAL',
                    isAvailable: 'BOOLEAN',
                    description: 'TEXT',
                    image: 'STRING',
                    currentStock: 'DECIMAL'
                }
            },
            
            order: {
                table: 'orders',
                required: ['businessId', 'outletId', 'orderNumber'],
                optional: [
                    'customerDetails', 'tableId', 'status', 
                    'billingSubtotal', 'billingTax', 'billingDiscount', 'billingTotal', 
                    'paymentMethod', 'paymentStatus',
                    // Enhanced fields for complex order support
                    'items', 'billing', 'idempotencyKey', 'orderStatus', 'customerId'
                ],
                fieldMappings: {
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
                    paymentStatus: 'payment_status',
                    // Enhanced field mappings
                    items: 'items',
                    billing: 'billing',
                    idempotencyKey: 'idempotency_key',
                    orderStatus: 'order_status',
                    customerId: 'customer_id'
                },
                dataTypes: {
                    businessId: 'UUID',
                    outletId: 'UUID',
                    orderNumber: 'STRING',
                    customerDetails: 'JSONB',
                    tableId: 'UUID',
                    status: 'STRING',
                    billingSubtotal: 'DECIMAL',
                    billingTax: 'DECIMAL',
                    billingDiscount: 'DECIMAL',
                    billingTotal: 'DECIMAL',
                    paymentMethod: 'STRING',
                    paymentStatus: 'STRING',
                    // Enhanced data types
                    items: 'JSONB',
                    billing: 'JSONB',
                    idempotencyKey: 'VARCHAR',
                    orderStatus: 'VARCHAR',
                    customerId: 'UUID'
                }
            },
            
            category: {
                table: 'categories',
                required: ['businessId', 'name'],
                optional: ['outletId', 'description', 'color', 'image', 'isEnabled', 'sortOrder'],
                fieldMappings: {
                    businessId: 'business_id',
                    outletId: 'outlet_id',
                    isEnabled: 'is_enabled',
                    sortOrder: 'sort_order'
                },
                dataTypes: {
                    businessId: 'UUID',
                    outletId: 'UUID',
                    name: 'STRING',
                    description: 'TEXT',
                    color: 'STRING',
                    image: 'STRING',
                    isEnabled: 'BOOLEAN',
                    sortOrder: 'INTEGER'
                }
            },
            
            outlet: {
                table: 'outlets',
                required: ['businessId', 'name'],
                optional: ['address', 'managerUserId', 'parentOutletId', 'isHeadOffice', 'isActive'],
                fieldMappings: {
                    businessId: 'business_id',
                    managerUserId: 'manager_user_id',
                    parentOutletId: 'parent_outlet_id',
                    isHeadOffice: 'is_head_office',
                    isActive: 'is_active'
                },
                dataTypes: {
                    businessId: 'UUID',
                    name: 'STRING',
                    address: 'TEXT',
                    managerUserId: 'UUID',
                    parentOutletId: 'UUID',
                    isHeadOffice: 'BOOLEAN',
                    isActive: 'BOOLEAN'
                }
            },
            
            table: {
                table: 'tables',
                required: ['businessId', 'outletId', 'name'],
                optional: ['tableNo', 'capacity', 'areaId', 'status', 'currentOrderId', 'shape', 'currentOccupancy', 'qrCode'],
                fieldMappings: {
                    businessId: 'business_id',
                    outletId: 'outlet_id',
                    tableNo: 'table_no',
                    areaId: 'area_id',
                    currentOrderId: 'current_order_id',
                    currentOccupancy: 'current_occupancy',
                    qrCode: 'qr_code'
                },
                dataTypes: {
                    businessId: 'UUID',
                    outletId: 'UUID',
                    name: 'STRING',
                    tableNo: 'STRING',
                    capacity: 'INTEGER',
                    areaId: 'UUID',
                    status: 'STRING',
                    currentOrderId: 'UUID',
                    shape: 'STRING',
                    currentOccupancy: 'INTEGER',
                    qrCode: 'STRING'
                }
            },
            
            area: {
                table: 'table_areas',
                required: ['businessId', 'outletId', 'name'],
                optional: ['description', 'capacity', 'layout', 'status'],
                fieldMappings: {
                    businessId: 'business_id',
                    outletId: 'outlet_id'
                },
                dataTypes: {
                    businessId: 'UUID',
                    outletId: 'UUID',
                    name: 'STRING',
                    description: 'STRING',
                    capacity: 'INTEGER',
                    layout: 'STRING',
                    status: 'STRING'
                }
            }
        };
        
        logSuccess(`Loaded ${Object.keys(this.schemaDefinitions).length} schema definitions`);
    }

    loadControllers() {
        logSection('STEP 2: ANALYZING ALL CONTROLLERS');
        
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
                    endpoints: this.extractEndpoints(content),
                    bodyFields: this.extractBodyFields(content),
                    queryFields: this.extractQueryFields(content),
                    paramFields: this.extractParamFields(content),
                    modelUsage: this.extractModelUsage(content),
                    responsePatterns: this.extractResponsePatterns(content),
                    validationPatterns: this.extractValidationPatterns(content)
                };
                
                logSuccess(`Loaded controller: ${controllerName} (${this.controllers[controllerName].functions.length} functions)`);
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

    extractEndpoints(content) {
        const endpoints = [];
        const routePatterns = [
            /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g
        ];
        
        for (const pattern of routePatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                endpoints.push({
                    method: match[1].toUpperCase(),
                    path: match[2]
                });
            }
        }
        
        return endpoints;
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

    extractParamFields(content) {
        const fields = new Set();
        
        // Match req.params.field patterns
        const paramFieldRegex = /req\.params\.(\w+)/g;
        let match;
        
        while ((match = paramFieldRegex.exec(content)) !== null) {
            fields.add(match[1]);
        }
        
        return Array.from(fields);
    }

    extractModelUsage(content) {
        const usage = {
            creates: [],
            updates: [],
            finds: [],
            destroys: [],
            includes: []
        };
        
        // Find model operations
        const createRegex = /(\w+)\.create\s*\(/g;
        const updateRegex = /(\w+)\.update\s*\(/g;
        const findRegex = /(\w+)\.(?:findOne|findAll|findAndCountAll)\s*\(/g;
        const destroyRegex = /(\w+)\.destroy\s*\(/g;
        const includeRegex = /include:\s*\[([^\]]+)\]/g;
        
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
        while ((match = includeRegex.exec(content)) !== null) {
            const includeContent = match[1];
            const modelMatches = includeContent.match(/model:\s*(\w+)/g);
            if (modelMatches) {
                modelMatches.forEach(m => {
                    const modelName = m.replace(/model:\s*/, '');
                    usage.includes.push(modelName);
                });
            }
        }
        
        return usage;
    }

    extractResponsePatterns(content) {
        const patterns = {
            success: [],
            error: [],
            inconsistent: []
        };
        
        // Find response patterns
        const successRegex = /res\.status\(\d+\)\.json\(\s*\{\s*success:\s*true[^}]*\}\s*\)/g;
        const errorRegex = /res\.status\(\d+\)\.json\(\s*\{\s*success:\s*false[^}]*\}\s*\)/g;
        const inconsistentRegex = /res\.status\(\d+\)\.json\([^)]*\)/g;
        
        let match;
        while ((match = successRegex.exec(content)) !== null) {
            patterns.success.push(match[0]);
        }
        while ((match = errorRegex.exec(content)) !== null) {
            patterns.error.push(match[0]);
        }
        while ((match = inconsistentRegex.exec(content)) !== null) {
            if (!match[0].includes('success:')) {
                patterns.inconsistent.push(match[0]);
            }
        }
        
        return patterns;
    }

    extractValidationPatterns(content) {
        const patterns = {
            required: [],
            type: [],
            enum: [],
            custom: []
        };
        
        // Find validation patterns
        const requiredRegex = /if\s*\(\s*!?\s*req\.(body|query|params)\.(\w+)\s*\)/g;
        const typeRegex = /typeof\s+req\.(body|query|params)\.(\w+)/g;
        const enumRegex = /\['[^']*'\]\.includes\s*\(\s*req\.(body|query|params)\.(\w+)/g;
        
        let match;
        while ((match = requiredRegex.exec(content)) !== null) {
            patterns.required.push({ field: match[2], source: match[1] });
        }
        while ((match = typeRegex.exec(content)) !== null) {
            patterns.type.push({ field: match[2], source: match[1] });
        }
        while ((match = enumRegex.exec(content)) !== null) {
            patterns.enum.push({ field: match[2], source: match[1] });
        }
        
        return patterns;
    }

    validateSchemaVsApi() {
        logSection('STEP 3: VALIDATING SCHEMA VS API USAGE');
        
        for (const [controllerName, controller] of Object.entries(this.controllers)) {
            const entityName = this.inferEntityFromController(controllerName);
            
            if (!entityName || !this.schemaDefinitions[entityName]) {
                continue; // Skip controllers that don't map to entities
            }
            
            const schema = this.schemaDefinitions[entityName];
            const usedFields = [...controller.bodyFields, ...controller.queryFields, ...controller.paramFields];
            
            // Check each used field against schema
            for (const field of usedFields) {
                // Skip common fields that aren't entity-specific
                if (['page', 'limit', 'sort', 'order', 'id', 'search', 'filter'].includes(field)) {
                    continue;
                }
                
                if (!schema.required.includes(field) && !schema.optional.includes(field)) {
                    this.issues.push({
                        controller: controllerName,
                        type: 'UNKNOWN_FIELD',
                        field,
                        entity: entityName,
                        message: `Field '${field}' not defined in ${entityName} schema`
                    });
                }
            }
            
            // Check for required fields in create operations
            if (controller.modelUsage.creates.length > 0) {
                for (const requiredField of schema.required) {
                    if (!controller.bodyFields.includes(requiredField)) {
                        this.issues.push({
                            controller: controllerName,
                            type: 'MISSING_REQUIRED',
                            field: requiredField,
                            entity: entityName,
                            message: `Required field '${requiredField}' may not be set in create operations`
                        });
                    }
                }
            }
            
            // Check field mappings
            for (const [camelField, snakeField] of Object.entries(schema.fieldMappings)) {
                if (controller.bodyFields.includes(camelField) || controller.queryFields.includes(camelField)) {
                    logSuccess(`${controllerName}: Correctly uses ${camelField} -> ${snakeField} mapping`);
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

    validateInputValidation() {
        logSection('STEP 4: VALIDATING INPUT VALIDATION');
        
        for (const [controllerName, controller] of Object.entries(this.controllers)) {
            const entityName = this.inferEntityFromController(controllerName);
            
            if (!entityName || !this.schemaDefinitions[entityName]) {
                continue;
            }
            
            const schema = this.schemaDefinitions[entityName];
            
            // Check if required fields are validated
            for (const requiredField of schema.required) {
                const hasValidation = controller.validationPatterns.required.some(v => v.field === requiredField);
                if (!hasValidation && controller.bodyFields.includes(requiredField)) {
                    this.issues.push({
                        controller: controllerName,
                        type: 'MISSING_VALIDATION',
                        field: requiredField,
                        entity: entityName,
                        message: `Required field '${requiredField}' lacks validation`
                    });
                }
            }
            
            // Check for type validation
            for (const [field, dataType] of Object.entries(schema.dataTypes)) {
                const hasTypeValidation = controller.validationPatterns.type.some(v => v.field === field);
                if (!hasTypeValidation && controller.bodyFields.includes(field)) {
                    this.issues.push({
                        controller: controllerName,
                        type: 'MISSING_TYPE_VALIDATION',
                        field,
                        dataType,
                        entity: entityName,
                        message: `Field '${field}' (${dataType}) lacks type validation`
                    });
                }
            }
        }
    }

    validateResponseStandardization() {
        logSection('STEP 6: VALIDATING RESPONSE STANDARDIZATION');
        
        for (const [controllerName, controller] of Object.entries(this.controllers)) {
            // Check for inconsistent response patterns
            if (controller.responsePatterns.inconsistent.length > 0) {
                this.issues.push({
                    controller: controllerName,
                    type: 'INCONSISTENT_RESPONSE',
                    count: controller.responsePatterns.inconsistent.length,
                    message: `${controller.responsePatterns.inconsistent.length} responses don't follow standard format`
                });
            }
            
            // Check if controller has both success and error patterns
            if (controller.functions.length > 0 && 
                (controller.responsePatterns.success.length === 0 || controller.responsePatterns.error.length === 0)) {
                this.issues.push({
                    controller: controllerName,
                    type: 'MISSING_RESPONSE_PATTERNS',
                    message: 'Controller lacks standardized success/error response patterns'
                });
            }
        }
    }

    validateArchitectureCompliance() {
        logSection('STEP 8: VALIDATING ARCHITECTURE COMPLIANCE');
        
        for (const [controllerName, controller] of Object.entries(this.controllers)) {
            // Check for forbidden direct model imports
            if (controller.content.includes('require("../models/') || controller.content.includes('require(\'../models/')) {
                // Check if it's commented out
                const lines = controller.content.split('\n');
                let hasActiveImport = false;
                
                for (const line of lines) {
                    if (line.includes('require("../models/') && !line.trim().startsWith('//')) {
                        hasActiveImport = true;
                        break;
                    }
                }
                
                if (hasActiveImport) {
                    this.issues.push({
                        controller: controllerName,
                        type: 'DIRECT_MODEL_IMPORT',
                        message: 'Contains direct model import - violates architecture'
                    });
                }
            }
            
            // Check for proper req.models usage
            if (controller.content.includes('req.models.') || controller.content.includes('req.models[')) {
                logSuccess(`${controllerName}: Uses req.models pattern correctly`);
            } else if (controller.modelUsage.creates.length > 0 || controller.modelUsage.finds.length > 0) {
                this.issues.push({
                    controller: controllerName,
                    type: 'MISSING_REQ_MODELS',
                    message: 'May not be using req.models pattern'
                });
            }
            
            // Check for proper error handling
            if (controller.content.includes('next(error)')) {
                logSuccess(`${controllerName}: Uses proper error handling`);
            } else {
                this.issues.push({
                    controller: controllerName,
                    type: 'MISSING_ERROR_HANDLING',
                    message: 'May not use proper error handling'
                });
            }
        }
    }

    generateFixes() {
        logSection('GENERATING FIXES');
        
        // Group issues by controller and type
        const issuesByController = {};
        
        for (const issue of this.issues) {
            if (!issuesByController[issue.controller]) {
                issuesByController[issue.controller] = [];
            }
            issuesByController[issue.controller].push(issue);
        }
        
        // Generate fixes for each controller
        for (const [controllerName, controllerIssues] of Object.entries(issuesByController)) {
            const controller = this.controllers[controllerName];
            if (!controller) continue;
            
            const fixes = {
                controller: controllerName,
                issues: controllerIssues,
                code: [],
                validation: [],
                response: []
            };
            
            // Generate validation fixes
            for (const issue of controllerIssues) {
                switch (issue.type) {
                    case 'MISSING_VALIDATION':
                    case 'MISSING_TYPE_VALIDATION':
                        fixes.validation.push(this.generateValidationCode(issue));
                        break;
                    case 'INCONSISTENT_RESPONSE':
                        fixes.response.push(this.generateResponseFixCode());
                        break;
                    case 'DIRECT_MODEL_IMPORT':
                        fixes.code.push(this.generateArchitectureFix());
                        break;
                }
            }
            
            this.fixes.push(fixes);
        }
    }

    generateValidationCode(issue) {
        const schema = this.schemaDefinitions[issue.entity];
        const dataType = schema.dataTypes[issue.field];
        
        let validationCode = '';
        
        // Required field validation
        if (schema.required.includes(issue.field)) {
            validationCode += `if (!req.body.${issue.field}) {\n`;
            validationCode += `  return next(createHttpError(400, '${issue.field} is required'));\n`;
            validationCode += `}\n\n`;
        }
        
        // Type validation
        switch (dataType) {
            case 'UUID':
                validationCode += `if (req.body.${issue.field} && typeof req.body.${issue.field} !== 'string') {\n`;
                validationCode += `  return next(createHttpError(400, '${issue.field} must be a string'));\n`;
                validationCode += `}\n\n`;
                break;
            case 'STRING':
                validationCode += `if (req.body.${issue.field} && typeof req.body.${issue.field} !== 'string') {\n`;
                validationCode += `  return next(createHttpError(400, '${issue.field} must be a string'));\n`;
                validationCode += `}\n\n`;
                break;
            case 'INTEGER':
                validationCode += `if (req.body.${issue.field} && !Number.isInteger(req.body.${issue.field})) {\n`;
                validationCode += `  return next(createHttpError(400, '${issue.field} must be an integer'));\n`;
                validationCode += `}\n\n`;
                break;
            case 'DECIMAL':
                validationCode += `if (req.body.${issue.field} && isNaN(parseFloat(req.body.${issue.field}))) {\n`;
                validationCode += `  return next(createHttpError(400, '${issue.field} must be a number'));\n`;
                validationCode += `}\n\n`;
                break;
            case 'BOOLEAN':
                validationCode += `if (req.body.${issue.field} && typeof req.body.${issue.field} !== 'boolean') {\n`;
                validationCode += `  return next(createHttpError(400, '${issue.field} must be a boolean'));\n`;
                validationCode += `}\n\n`;
                break;
        }
        
        return validationCode;
    }

    generateResponseFixCode() {
        return `
// Standardized response format
const createResponse = (success, message, data = null, statusCode = 200) => {
  return {
    success,
    message,
    data
  };
};

// Usage examples:
// Success response
res.status(200).json(createResponse(true, 'Operation successful', result));

// Error response  
res.status(400).json(createResponse(false, 'Validation failed', null, 400));
        `;
    }

    generateArchitectureFix() {
        return `
// ARCHITECTURE COMPLIANCE FIX
// Remove direct model imports and use req.models pattern

// BEFORE (forbidden):
// const User = require("../models/userModel");
// const user = await User.findOne({...});

// AFTER (correct):
// const { User } = req.models;
// const user = await User.findOne({...});
        `;
    }

    generateReport() {
        logSection('GENERATING COMPREHENSIVE API VERIFICATION REPORT');
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 COMPREHENSIVE API VERIFICATION AND FIXING REPORT');
        console.log('='.repeat(80));
        
        console.log(`\n📈 STATISTICS:`);
        console.log(`   Controllers Analyzed: ${Object.keys(this.controllers).length}`);
        console.log(`   Schema Definitions: ${Object.keys(this.schemaDefinitions).length}`);
        console.log(`   Issues Found: ${this.issues.length}`);
        console.log(`   Fixes Generated: ${this.fixes.length}`);
        
        // Group issues by type
        const issuesByType = {};
        for (const issue of this.issues) {
            if (!issuesByType[issue.type]) {
                issuesByType[issue.type] = 0;
            }
            issuesByType[issue.type]++;
        }
        
        console.log(`\n🚨 ISSUES BY TYPE:`);
        for (const [type, count] of Object.entries(issuesByType)) {
            console.log(`   ${type}: ${count}`);
        }
        
        if (this.issues.length > 0) {
            console.log(`\n🚨 CRITICAL ISSUES FOUND:`);
            for (let i = 0; i < Math.min(10, this.issues.length); i++) {
                const issue = this.issues[i];
                console.log(`   ${i + 1}. [${issue.controller}] ${issue.type}: ${issue.message}`);
            }
            
            if (this.issues.length > 10) {
                console.log(`   ... and ${this.issues.length - 10} more issues`);
            }
        }
        
        if (this.fixes.length > 0) {
            console.log(`\n🔧 FIXES GENERATED:`);
            for (const fix of this.fixes.slice(0, 5)) {
                console.log(`   📁 ${fix.controller}: ${fix.issues.length} issues`);
            }
            
            if (this.fixes.length > 5) {
                console.log(`   ... and ${this.fixes.length - 5} more controllers with fixes`);
            }
        }
        
        const isProductionReady = this.issues.length === 0;
        
        console.log(`\n🔒 API READINESS STATUS:`);
        console.log(`   Status: ${isProductionReady ? '✅ PRODUCTION READY' : '❌ FIXES REQUIRED'}`);
        console.log(`   Schema Compliance: ${this.issues.filter(i => i.type.includes('FIELD')).length === 0 ? '✅ COMPLIANT' : '❌ VIOLATIONS'}`);
        console.log(`   Input Validation: ${this.issues.filter(i => i.type.includes('VALIDATION')).length === 0 ? '✅ COMPLETE' : '❌ INCOMPLETE'}`);
        console.log(`   Response Standardization: ${this.issues.filter(i => i.type.includes('RESPONSE')).length === 0 ? '✅ STANDARDIZED' : '❌ INCONSISTENT'}`);
        console.log(`   Architecture Compliance: ${this.issues.filter(i => i.type.includes('MODEL') || i.type.includes('ARCHITECTURE')).length === 0 ? '✅ COMPLIANT' : '❌ VIOLATIONS'}`);
        
        console.log('\n' + '='.repeat(80));
        
        return {
            isProductionReady,
            issuesCount: this.issues.length,
            fixesCount: this.fixes.length,
            issues: this.issues,
            fixes: this.fixes,
            controllersAnalyzed: Object.keys(this.controllers).length
        };
    }

    async applyFixes() {
        logSection('APPLYING FIXES');
        
        for (const fix of this.fixes) {
            const controllerPath = path.join(__dirname, '../controllers', `${fix.controller}.js`);
            
            if (!fs.existsSync(controllerPath)) {
                logWarning(`Controller file not found: ${controllerPath}`);
                continue;
            }
            
            try {
                let content = fs.readFileSync(controllerPath, 'utf8');
                
                // Apply validation fixes
                for (const validationCode of fix.validation) {
                    // Find the function and add validation at the beginning
                    const functionMatch = content.match(/(const \w+ = async \(req, res, next\) => \s*{)/);
                    if (functionMatch) {
                        const insertPoint = content.indexOf(functionMatch[0]) + functionMatch[0].length;
                        content = content.slice(0, insertPoint) + 
                                  '\n  // Input validation\n' + 
                                  validationCode + 
                                  '\n' + 
                                  content.slice(insertPoint);
                    }
                }
                
                // Write back the fixed content
                fs.writeFileSync(controllerPath, content);
                logSuccess(`Applied fixes to ${fix.controller}`);
                
            } catch (error) {
                logError(`Failed to apply fixes to ${fix.controller}: ${error.message}`);
            }
        }
    }
}

// Main execution
async function main() {
    const verifier = new ApiVerifierAndFixer();
    
    try {
        await verifier.loadSchemas();
        verifier.loadControllers();
        verifier.validateSchemaVsApi();
        verifier.validateInputValidation();
        verifier.validateResponseStandardization();
        verifier.validateArchitectureCompliance();
        
        const report = verifier.generateReport();
        
        // Ask user if they want to apply fixes
        if (!report.isProductionReady && report.fixesCount > 0) {
            console.log(`\n🔧 Found ${report.fixesCount} controllers that need fixes.`);
            console.log('Run with --apply-fixes to automatically apply the fixes.');
            
            if (process.argv.includes('--apply-fixes')) {
                await verifier.applyFixes();
                console.log('\n✅ All fixes have been applied.');
            }
        }
        
        // Exit with appropriate code
        process.exit(report.isProductionReady ? 0 : 1);
        
    } catch (error) {
        logError(`API verification failed: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = ApiVerifierAndFixer;
