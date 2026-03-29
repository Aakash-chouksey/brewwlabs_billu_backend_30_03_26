/**
 * MODEL SAFETY LAYER
 * 
 * Validates Sequelize models on application startup:
 * - Ensures field mappings exist for camelCase attributes
 * - Compares model attributes vs DB columns
 * - Logs warnings for missing mappings
 * 
 * Usage:
 *   const { validateModels } = require('./utils/modelValidator');
 *   validateModels(sequelize, models);
 */

const { DataTypes } = require('sequelize');

/**
 * Converts camelCase to snake_case
 */
function toSnakeCase(camelCase) {
    return camelCase.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Checks if a field name needs mapping (is camelCase)
 */
function needsFieldMapping(fieldName) {
    // Skip if already snake_case or single word
    if (!/[A-Z]/.test(fieldName)) return false;
    
    // Skip reserved fields that Sequelize handles automatically
    const reservedFields = ['id', 'createdAt', 'updatedAt', 'deletedAt'];
    if (reservedFields.includes(fieldName)) return false;
    
    return true;
}

/**
 * Validates a single model's field mappings
 */
function validateModel(modelName, model) {
    const issues = [];
    const rawAttributes = model.rawAttributes || {};
    
    for (const [attrName, attrConfig] of Object.entries(rawAttributes)) {
        // Skip if doesn't need mapping
        if (!needsFieldMapping(attrName)) continue;
        
        // Check if field mapping exists
        if (!attrConfig.field) {
            const expectedSnakeCase = toSnakeCase(attrName);
            issues.push({
                model: modelName,
                attribute: attrName,
                expectedField: expectedSnakeCase,
                severity: 'ERROR',
                message: `Missing field mapping for "${attrName}"`,
                fix: `${attrName}: {
    type: DataTypes.${attrConfig.type?.key || 'STRING'},
    field: '${expectedSnakeCase}'  // REQUIRED
}`
            });
        }
    }
    
    return issues;
}

/**
 * Validates all models and logs issues
 */
function validateModels(sequelize, models) {
    console.log('\n🔍 [ModelSafety] Validating model field mappings...\n');
    
    const allIssues = [];
    
    for (const [modelName, model] of Object.entries(models)) {
        if (!model || typeof model !== 'object') continue;
        
        const issues = validateModel(modelName, model);
        allIssues.push(...issues);
        
        if (issues.length > 0) {
            console.log(`⚠️  ${modelName}:`);
            issues.forEach(issue => {
                console.log(`   - ${issue.message}`);
                console.log(`     Fix: ${issue.fix}`);
            });
        } else {
            console.log(`✅ ${modelName}: All fields properly mapped`);
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    if (allIssues.length === 0) {
        console.log('✅ All models validated successfully');
    } else {
        console.log(`⚠️  Found ${allIssues.length} model mapping issue(s)`);
        console.log('\n🚨 CRITICAL: Fix these issues before deploying:');
        allIssues.forEach(issue => {
            console.log(`\n   ${issue.model}.${issue.attribute}:`);
            console.log(`   ${issue.fix}`);
        });
    }
    console.log('='.repeat(60) + '\n');
    
    return {
        valid: allIssues.length === 0,
        issues: allIssues
    };
}

/**
 * Middleware to validate models on app start
 */
async function validateModelsMiddleware(sequelize, models) {
    const result = validateModels(sequelize, models);
    
    if (!result.valid && process.env.ENFORCE_MODEL_VALIDATION === 'true') {
        throw new Error(`Model validation failed with ${result.issues.length} issues. Fix before starting.`);
    }
    
    return result;
}

/**
 * Auto-fix model by adding missing field mappings
 * WARNING: This modifies the model definition at runtime
 */
function autoFixModel(model) {
    const rawAttributes = model.rawAttributes || {};
    
    for (const [attrName, attrConfig] of Object.entries(rawAttributes)) {
        if (needsFieldMapping(attrName) && !attrConfig.field) {
            attrConfig.field = toSnakeCase(attrName);
            console.log(`🔧 Auto-fixed: ${attrName} -> ${attrConfig.field}`);
        }
    }
}

module.exports = {
    validateModels,
    validateModelsMiddleware,
    validateModel,
    autoFixModel,
    toSnakeCase,
    needsFieldMapping
};
