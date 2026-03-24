#!/usr/bin/env node

/**
 * Fix test_user.js to follow architecture rules
 */

const fs = require('fs');
const path = require('path');

function fixTestUserController() {
    console.log('🔧 Fixing test_user.js controller...');
    
    const filePath = path.join(__dirname, '../controllers/test_user.js');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace direct sequelize imports with comments
    const replacements = [
        {
            from: "const { sequelize } = require('../config/database_postgres');",
            to: "// const { sequelize } = require('../config/database_postgres'); // Use req.sequelize instead"
        },
        {
            from: "const { Op, Sequelize } = require('sequelize');",
            to: "const { Op } = require('sequelize'); // Op is allowed for queries"
        }
    ];
    
    for (const replacement of replacements) {
        content = content.replace(new RegExp(replacement.from, 'g'), replacement.to);
    }
    
    fs.writeFileSync(filePath, content);
    console.log('✅ Fixed test_user.js controller');
}

if (require.main === module) {
    fixTestUserController();
}

module.exports = fixTestUserController;
