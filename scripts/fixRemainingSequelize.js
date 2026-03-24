#!/usr/bin/env node

/**
 * Fix remaining sequelize imports
 */

const fs = require('fs');
const path = require('path');

function fixRemainingSequelizeImports() {
    console.log('🔧 Fixing remaining sequelize imports...');
    
    const filePath = path.join(__dirname, '../controllers/test_user.js');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Find all lines with require('../config/database_postgres') and comment them out
    const lines = content.split('\n');
    let fixedLines = [];
    
    for (let line of lines) {
        if (line.includes("require('../config/database_postgres')") && !line.trim().startsWith('//')) {
            fixedLines.push('// ' + line.trim() + ' // Commented out - use req.sequelize instead');
        } else {
            fixedLines.push(line);
        }
    }
    
    fs.writeFileSync(filePath, fixedLines.join('\n'));
    console.log('✅ Fixed remaining sequelize imports');
}

if (require.main === module) {
    fixRemainingSequelizeImports();
}

module.exports = fixRemainingSequelizeImports;
