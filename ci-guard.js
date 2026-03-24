
const fs = require('fs');
const path = require('path');

function validateControllerSecurity() {
    console.log('🔍 CI GUARD: Validating controller security...');
    
    const controllersDir = path.join(__dirname, 'controllers');
    const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));
    
    let violations = [];
    
    controllerFiles.forEach(file => {
        const filePath = path.join(controllersDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for forbidden patterns
        const forbiddenPatterns = [
            /require('../config/database_postgres')/,
            /sequelize.query(/,
            /require('../models//,
            /admin@brewwlabs.com/,
            /aetherlogictechnologies@gmail.com/
        ];
        
        forbiddenPatterns.forEach(pattern => {
            if (pattern.test(content)) {
                violations.push({
                    file: `controllers/${file}`,
                    pattern: pattern.toString(),
                    lines: content.split('\n').map((line, i) => 
                        pattern.test(line) ? i + 1 : null
                    ).filter(Boolean)
                });
            }
        });
    });
    
    if (violations.length > 0) {
        console.error('🚨 CI GUARD FAILED - Security violations detected:');
        violations.forEach(v => {
            console.error(`   ❌ ${v.file}: ${v.pattern} at lines ${v.lines.join(', ')}`);
        });
        console.error('\n💥 ABORTING STARTUP - Fix violations before deploying\n');
        process.exit(1);
    } else {
        console.log('✅ CI GUARD PASSED - All controllers secure');
    }
}

// Run validation on startup
validateControllerSecurity();

module.exports = { validateControllerSecurity };
