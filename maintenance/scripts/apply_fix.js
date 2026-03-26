/**
 * 🛠️ POS BACKEND: AUTO-FIX ENGINE (V2 - CLEANER)
 */

const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, 'models');
const CP_MODELS_DIR = path.join(__dirname, 'control_plane_models');

function toSnakeCase(str) {
    return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}

function fixModelFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // 0. CLEANUP PREVIOUS MESS (if any)
    // Remove lines like: field: '...',type:
    if (content.includes("field: '") && content.includes("',type:")) {
        content = content.replace(/field:\s*'[^']*',\s*type:/g, "type:");
        modified = true;
    }

    // 1. Ensure underscored: true (cleanly)
    if (!content.includes('underscored: true')) {
        if (content.includes('tableName:')) {
            content = content.replace(/(tableName:\s*['"].*?['"])/, "$1,\n        underscored: true");
            modified = true;
        }
    }

    // 2. camelCase Attribute Mapping (Robust)
    // We target lines where a camelCase property starts an object, and doesn't already have a field.
    const attrBlockRegex = /^(\s+)([a-z][a-zA-Z0-9]*):\s*{\s*$/gm;
    let newContent = content.replace(attrBlockRegex, (match, indent, attrName) => {
        if (/[A-Z]/.test(attrName)) {
            // Check if it already has a field property in the next few lines
            const searchIndex = content.indexOf(match);
            const nextLines = content.substring(searchIndex, searchIndex + 100);
            if (!nextLines.includes('field:')) {
                modified = true;
                return `${indent}${attrName}: {\n${indent}    field: '${toSnakeCase(attrName)}',`;
            }
        }
        return match;
    });
    content = newContent;

    // 3. Timestamp Standardization
    const tsNames = ['createdAt', 'updatedAt'];
    tsNames.forEach(ts => {
        const tsRegex = new RegExp(`^(\\s+)${ts}:\\s*{\\s*$`, 'gm');
        content = content.replace(tsRegex, (match, indent) => {
            const searchIndex = content.indexOf(match);
            const nextLines = content.substring(searchIndex, searchIndex + 100);
            if (!nextLines.includes('field:')) {
                modified = true;
                return `${indent}${ts}: {\n${indent}    field: '${toSnakeCase(ts)}',`;
            }
            return match;
        });
        
        // Handle short form timestamps if they exist
        const shortTsRegex = new RegExp(`^(\\s+)${ts}:\\s*DataTypes\\.DATE`, 'gm');
        if (content.match(shortTsRegex)) {
             content = content.replace(shortTsRegex, (match, indent) => {
                 modified = true;
                 return `${indent}${ts}: {\n${indent}    type: DataTypes.DATE,\n${indent}    field: '${toSnakeCase(ts)}'\n${indent}}`;
             });
        }
    });

    if (modified) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Standardized: ${path.basename(filePath)}`);
    }
    return modified;
}

async function runFix() {
    console.log('🚀 Starting Auto-Fix Engine V2...');
    
    const dirs = [MODELS_DIR, CP_MODELS_DIR];
    let count = 0;
    
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
        for (const file of files) {
            if (fixModelFile(path.join(dir, file))) count++;
        }
    }

    console.log(`✨ Completed! Fixed/Cleaned ${count} model files.`);
}

runFix().catch(console.error);
