#!/usr/bin/env node
/**
 * MODEL AUDIT UTILITY
 * 
 * Scans all models and generates a comprehensive audit report:
 * - Lists all models with their attributes
 * - Identifies missing field mappings
 * - Generates fix suggestions
 * 
 * Usage:
 *   node scripts/auditModels.js
 */

const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '..', 'models');
const CONTROL_PLANE_MODELS_DIR = path.join(__dirname, '..', 'control_plane_models');

/**
 * Extracts field definitions from model file content
 */
function extractFields(content) {
    const fields = [];
    
    // Match pattern: fieldName: { ... }
    const fieldPattern = /(\w+):\s*\{([^}]+)\}/g;
    let match;
    
    while ((match = fieldPattern.exec(content)) !== null) {
        const fieldName = match[1];
        const fieldConfig = match[2];
        
        // Skip if not camelCase or is reserved
        if (!/[A-Z]/.test(fieldName)) continue;
        if (['DataTypes', 'Sequelize'].includes(fieldName)) continue;
        
        const hasFieldMapping = fieldConfig.includes('field:');
        
        fields.push({
            name: fieldName,
            snakeCase: toSnakeCase(fieldName),
            hasFieldMapping,
            config: fieldConfig.trim()
        });
    }
    
    return fields;
}

/**
 * Converts camelCase to snake_case
 */
function toSnakeCase(camelCase) {
    return camelCase.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Audits a single model file
 */
function auditModelFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const modelName = path.basename(filePath, '.js');
    
    const fields = extractFields(content);
    const missingMappings = fields.filter(f => !f.hasFieldMapping);
    
    return {
        name: modelName,
        path: filePath,
        totalFields: fields.length,
        mappedFields: fields.filter(f => f.hasFieldMapping).length,
        missingMappings,
        fields
    };
}

/**
 * Audits all models in a directory
 */
function auditDirectory(dirPath, type) {
    if (!fs.existsSync(dirPath)) return [];
    
    const files = fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.js') && !f.startsWith('index'))
        .map(f => path.join(dirPath, f));
    
    return files.map(file => ({
        ...auditModelFile(file),
        type
    }));
}

/**
 * Generates fix script for missing mappings
 */
function generateFixScript(results) {
    let script = '';
    
    results.forEach(model => {
        if (model.missingMappings.length > 0) {
            script += `\n// ${model.name} (${model.type})\n`;
            model.missingMappings.forEach(field => {
                script += `// Add to ${path.basename(model.path)}:\n`;
                script += `${field.name}: {\n`;
                script += `    field: '${field.snakeCase}',\n`;
                script += `    // ... existing config\n`;
                script += `},\n`;
            });
        }
    });
    
    return script;
}

/**
 * Main audit function
 */
function runAudit() {
    console.log('\n🔍 MODEL AUDIT UTILITY\n');
    console.log('=' .repeat(80));
    
    // Audit tenant models
    const tenantModels = auditDirectory(MODELS_DIR, 'TENANT');
    const controlPlaneModels = auditDirectory(CONTROL_PLANE_MODELS_DIR, 'CONTROL');
    
    const allModels = [...tenantModels, ...controlPlaneModels];
    
    let totalMissing = 0;
    
    allModels.forEach(model => {
        if (model.missingMappings.length > 0) {
            console.log(`\n⚠️  ${model.name} (${model.type})`);
            console.log(`   Missing field mappings: ${model.missingMappings.length}`);
            model.missingMappings.forEach(field => {
                console.log(`   - ${field.name} -> ${field.snakeCase}`);
                totalMissing++;
            });
        }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Models: ${allModels.length}`);
    console.log(`   Models with Issues: ${allModels.filter(m => m.missingMappings.length > 0).length}`);
    console.log(`   Total Missing Mappings: ${totalMissing}`);
    
    if (totalMissing > 0) {
        console.log(`\n🚨 ACTION REQUIRED:`);
        console.log(`   Fix ${totalMissing} missing field mapping(s) before deployment`);
        
        const fixScript = generateFixScript(allModels);
        const fixPath = path.join(__dirname, '..', 'model_fixes_suggested.txt');
        fs.writeFileSync(fixPath, fixScript);
        console.log(`\n📄 Fix suggestions written to: ${fixPath}`);
    } else {
        console.log(`\n✅ All models properly configured`);
    }
    
    return {
        totalModels: allModels.length,
        issues: totalMissing,
        models: allModels
    };
}

// Run if called directly
if (require.main === module) {
    runAudit();
}

module.exports = { runAudit, auditModelFile, auditDirectory };
