/**
 * NAMING CONVENTION ENFORCEMENT UTILITY
 * 
 * Enforces consistent naming across the codebase:
 * - DB columns: snake_case
 * - Model attributes: camelCase
 * - Table names: snake_case, plural
 * 
 * This utility can be integrated into CI/CD pipelines
 */

const fs = require('fs');
const path = require('path');

/**
 * Naming convention rules
 */
const RULES = {
    // Database columns should be snake_case
    DB_COLUMN: {
        pattern: /^[a-z][a-z0-9_]*$/,
        message: 'DB columns must be snake_case'
    },
    // Model attributes should be camelCase
    MODEL_ATTRIBUTE: {
        pattern: /^[a-z][a-zA-Z0-9]*$/,
        message: 'Model attributes should be camelCase'
    },
    // Table names should be snake_case, plural
    TABLE_NAME: {
        pattern: /^[a-z][a-z0-9_]*s$/,
        message: 'Table names should be snake_case and plural'
    }
};

/**
 * Validates if a string follows snake_case
 */
function isSnakeCase(str) {
    return /^[a-z][a-z0-9_]*$/.test(str) && !/[A-Z]/.test(str);
}

/**
 * Validates if a string follows camelCase
 */
function isCamelCase(str) {
    return /^[a-z][a-zA-Z0-9]*$/.test(str) && /[A-Z]/.test(str);
}

/**
 * Converts camelCase to snake_case
 */
function toSnakeCase(camelCase) {
    return camelCase.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Converts snake_case to camelCase
 */
function toCamelCase(snakeCase) {
    return snakeCase.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Checks naming convention compliance in a model file
 */
function checkModelFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];
    
    // Check tableName
    const tableNameMatch = content.match(/tableName:\s*['"]([^'"]+)['"]/);
    if (tableNameMatch) {
        const tableName = tableNameMatch[1];
        if (!isSnakeCase(tableName)) {
            issues.push({
                type: 'TABLE_NAME',
                value: tableName,
                line: getLineNumber(content, tableNameMatch.index),
                message: `Table name "${tableName}" should be snake_case`,
                fix: toSnakeCase(tableName).replace(/s$/, '') + 's'
            });
        }
    }
    
    // Check field mappings
    const fieldPattern = /(\w+):\s*\{[^}]*field:\s*['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = fieldPattern.exec(content)) !== null) {
        const attrName = match[1];
        const fieldName = match[2];
        
        // Attribute should be camelCase
        if (!isCamelCase(attrName) && /_/.test(attrName)) {
            issues.push({
                type: 'ATTRIBUTE_NAMING',
                value: attrName,
                line: getLineNumber(content, match.index),
                message: `Attribute "${attrName}" should be camelCase`,
                fix: toCamelCase(attrName)
            });
        }
        
        // Field should be snake_case
        if (!isSnakeCase(fieldName)) {
            issues.push({
                type: 'FIELD_NAMING',
                value: fieldName,
                line: getLineNumber(content, match.index),
                message: `DB field "${fieldName}" should be snake_case`,
                fix: toSnakeCase(fieldName)
            });
        }
        
        // Verify mapping is correct
        const expectedFieldName = toSnakeCase(attrName);
        if (fieldName !== expectedFieldName && !['_id', '_at', '_by'].some(s => fieldName.endsWith(s))) {
            // Check special cases
            const specialMappings = {
                'businessId': 'business_id',
                'outletId': 'outlet_id',
                'createdAt': 'created_at',
                'updatedAt': 'updated_at',
                'deletedAt': 'deleted_at',
                'createdBy': 'created_by',
                'isActive': 'is_active'
            };
            
            if (specialMappings[attrName] && fieldName !== specialMappings[attrName]) {
                issues.push({
                    type: 'INCORRECT_MAPPING',
                    value: `${attrName} -> ${fieldName}`,
                    line: getLineNumber(content, match.index),
                    message: `Field mapping for "${attrName}" should be "${specialMappings[attrName]}"`,
                    fix: `field: '${specialMappings[attrName]}'`
                });
            }
        }
    }
    
    // Check for camelCase attributes without field mapping
    const attrPattern = /(\w+):\s*\{[^}]*type:\s*DataTypes\./g;
    while ((match = attrPattern.exec(content)) !== null) {
        const attrName = match[1];
        
        // Skip if not camelCase or is reserved
        if (!isCamelCase(attrName)) continue;
        if (['id', 'createdAt', 'updatedAt', 'deletedAt'].includes(attrName)) continue;
        
        // Check if field mapping exists in the same definition
        const definitionStart = match.index;
        const definitionEnd = content.indexOf('}', definitionStart);
        const definition = content.substring(definitionStart, definitionEnd);
        
        if (!definition.includes('field:')) {
            issues.push({
                type: 'MISSING_FIELD_MAPPING',
                value: attrName,
                line: getLineNumber(content, match.index),
                message: `Attribute "${attrName}" is missing field mapping`,
                fix: `${attrName}: {
    field: '${toSnakeCase(attrName)}',
    type: DataTypes... // existing type
}`
            });
        }
    }
    
    return {
        file: filePath,
        issues: issues.filter((issue, index, self) => 
            index === self.findIndex(i => i.value === issue.value && i.type === issue.type)
        )
    };
}

/**
 * Gets line number from content index
 */
function getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
}

/**
 * Scans directory for model files
 */
function scanDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return [];
    
    return fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.js') && !f.startsWith('index'))
        .map(f => path.join(dirPath, f));
}

/**
 * Runs full naming convention audit
 */
function runNamingConventionAudit(modelsDir, controlPlaneModelsDir) {
    console.log('\n📋 NAMING CONVENTION AUDIT\n');
    console.log('=' .repeat(80));
    
    const modelFiles = [
        ...scanDirectory(modelsDir),
        ...scanDirectory(controlPlaneModelsDir)
    ];
    
    const results = modelFiles.map(file => checkModelFile(file));
    const filesWithIssues = results.filter(r => r.issues.length > 0);
    
    let totalIssues = 0;
    
    filesWithIssues.forEach(result => {
        console.log(`\n⚠️  ${path.basename(result.file)}:`);
        result.issues.forEach(issue => {
            totalIssues++;
            console.log(`   Line ${issue.line}: ${issue.message}`);
            console.log(`   Suggested fix: ${issue.fix}`);
        });
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Files scanned: ${modelFiles.length}`);
    console.log(`   Files with issues: ${filesWithIssues.length}`);
    console.log(`   Total issues: ${totalIssues}`);
    
    if (totalIssues === 0) {
        console.log(`\n✅ All models follow naming conventions`);
    } else {
        console.log(`\n🚨 ACTION REQUIRED: Fix ${totalIssues} naming convention issue(s)`);
    }
    
    return {
        totalFiles: modelFiles.length,
        filesWithIssues: filesWithIssues.length,
        totalIssues,
        results
    };
}

module.exports = {
    isSnakeCase,
    isCamelCase,
    toSnakeCase,
    toCamelCase,
    checkModelFile,
    runNamingConventionAudit,
    RULES
};

// Run if called directly
if (require.main === module) {
    const modelsDir = path.join(__dirname, '..', 'models');
    const controlPlaneDir = path.join(__dirname, '..', 'control_plane_models');
    runNamingConventionAudit(modelsDir, controlPlaneDir);
}
