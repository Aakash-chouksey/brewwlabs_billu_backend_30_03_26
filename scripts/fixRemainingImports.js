#!/usr/bin/env node

/**
 * FIX REMAINING IMPORTS SCRIPT
 * 
 * This script fixes the remaining direct imports that the first script missed.
 */

const fs = require('fs');
const path = require('path');

function fixRemainingImports(filePath) {
    console.log(`🔧 Fixing remaining imports in: ${path.basename(filePath)}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Remove remaining sequelize imports
    content = content.replace(
        /const\s*\{\s*sequelize\s*\}\s*=\s*require\s*\(\s*["'][^"']*database[^"']*["']\s*\)\s*[;]?\s*\/\/?.*$/gm,
        '// Sequelize import removed - use req.sequelize instead'
    );
    
    // Remove remaining direct model imports
    content = content.replace(
        /const\s+\w+\s*=\s*require\s*\(\s*["'][^"']*models[^"']*["']\s*\)\s*[;]?\s*\/\/?.*$/gm,
        '// Direct model import removed - use req.models instead'
    );
    
    // Fix control plane model imports (should be allowed for admin routes)
    if (filePath.includes('superAdminController')) {
        // Keep control plane imports for admin routes
        content = content.replace(
            /\/\/\s*const\s*\{[^}]*\}\s*=\s*require\s*\(\s*["'][^"']*control_plane_models[^"']*["']\s*\)\s*[;]?\s*\/\/?.*$/gm,
            (match) => match.replace('// ', '')
        );
    }
    
    // Add model destructuring to functions that use models but don't have destructuring
    const functionPattern = /(async\s+\w+\s*\([^)]*\)\s*=>\s*{|async\s+function\s+\w+\s*\([^)]*\)\s*{)/g;
    let match;
    
    while ((match = functionPattern.exec(content)) !== null) {
        const functionStart = match[0];
        const functionBodyStart = match.index + functionStart.length;
        
        // Get the function body (simplified - just check a few lines)
        const linesAfter = content.substring(functionBodyStart, functionBodyStart + 500);
        
        // Check if function uses models but doesn't destructure them
        if (linesAfter.includes('req.models.') && !linesAfter.includes('const {') && !linesAfter.includes('const models =')) {
            // This function uses req.models but doesn't destructure - add comment
            const insertPos = functionBodyStart;
            const comment = '\n        // TODO: Add model destructuring: const { ModelName } = req.models;\n        ';
            content = content.slice(0, insertPos) + comment + content.slice(insertPos);
        }
    }
    
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed remaining imports in: ${path.basename(filePath)}`);
        return true;
    } else {
        console.log(`⏭️  No additional fixes needed: ${path.basename(filePath)}`);
        return false;
    }
}

function main() {
    console.log('🚀 Fixing remaining imports...\n');
    
    const controllersDir = path.join(__dirname, '../controllers');
    const controllerFiles = fs.readdirSync(controllersDir)
        .filter(file => file.endsWith('.js'))
        .map(file => path.join(controllersDir, file));
    
    let fixedCount = 0;
    
    for (const filePath of controllerFiles) {
        try {
            if (fixRemainingImports(filePath)) {
                fixedCount++;
            }
        } catch (error) {
            console.error(`❌ Error fixing ${path.basename(filePath)}:`, error.message);
        }
    }
    
    console.log(`\n📊 Fix Summary:`);
    console.log(`   Fixed controllers: ${fixedCount}`);
    
    console.log(`\n✅ Import fixing complete!`);
    console.log(`   All controllers should now follow the strict architecture pattern.`);
}

if (require.main === module) {
    main();
}

module.exports = { fixRemainingImports };
