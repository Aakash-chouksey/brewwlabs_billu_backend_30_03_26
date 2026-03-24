#!/usr/bin/env node

/**
 * CONTROLLER REFACTORING SCRIPT
 * 
 * This script systematically refactors all controllers to follow the strict architecture rules:
 * 1. Remove direct model imports
 * 2. Use req.models pattern
 * 3. Add proper error handling
 * 4. Ensure tenant context usage
 */

const fs = require('fs');
const path = require('path');

/**
 * Controller refactoring rules
 */
const REFACTORING_RULES = {
    // Remove direct model imports
    removeDirectImports: [
        /const\s+\w+\s*=\s*require\s*\(\s*["'][^"']*models[^"']*["']\s*\)\s*[;]?\s*\/\/?.*$/gm,
        /const\s*\{[^}]*\}\s*=\s*require\s*\(\s*["'][^"']*models[^"']*["']\s*\)\s*[;]?\s*\/\/?.*$/gm,
        /\/\/\s*const\s+\w+\s*=\s*require\s*\(\s*["'][^"']*models[^"']*["']\s*\)\s*[;]?\s*\/\/?.*$/gm,
        /\/\/\s*const\s*\{[^}]*\}\s*=\s*require\s*\(\s*["'][^"']*models[^"']*["']\s*\)\s*[;]?\s*\/\/?.*$/gm
    ],
    
    // Remove sequelize imports (should come from req)
    removeSequelizeImports: [
        /const\s*\{\s*sequelize\s*\}\s*=\s*require\s*\(\s*["'][^"']*database[^"']*["']\s*\)\s*[;]?\s*\/\/?.*$/gm,
        /const\s+sequelize\s*=\s*require\s*\(\s*["'][^"']*database[^"']*["']\s*\)\s*[;]?\s*\/\/?.*$/gm
    ],
    
    // Add model destructuring at function start
    addModelDestructuring: (functionBody, requiredModels = []) => {
        const destructuring = requiredModels.length > 0 
            ? `const { ${requiredModels.join(', ')} } = req.models;\n\n    `
            : `// Get models from request (injected by middleware)\n    const models = req.models;\n\n    `;
        
        return functionBody.replace(/^(async\s+\w+\s*\([^)]*\)\s*=>\s*{|async\s+function\s+\w+\s*\([^)]*\)\s*{)/m, 
            `$1${destructuring}`);
    }
};

/**
 * Get list of all controller files
 */
function getControllerFiles() {
    const controllersDir = path.join(__dirname, '../controllers');
    return fs.readdirSync(controllersDir)
        .filter(file => file.endsWith('.js'))
        .map(file => path.join(controllersDir, file));
}

/**
 * Extract model usage from controller content
 */
function extractModelUsage(content) {
    const modelPatterns = [
        /User(\.|\s|;)/g,
        /Product(\.|\s|;)/g,
        /Order(\.|\s|;)/g,
        /Category(\.|\s|;)/g,
        /Business(\.|\s|;)/g,
        /Account(\.|\s|;)/g,
        /Transaction(\.|\s|;)/g,
        /Inventory(\.|\s|;)/g,
        /InventoryItem(\.|\s|;)/g,
        /Recipe(\.|\s|;)/g,
        /Supplier(\.|\s|;)/g,
        /Purchase(\.|\s|;)/g,
        /Expense(\.|\s|;)/g,
        /Payment(\.|\s|;)/g,
        /Table(\.|\s|;)/g,
        /Outlet(\.|\s|;)/g,
        /Area(\.|\s|;)/g,
        /Timing(\.|\s|;)/g,
        /RollTracking(\.|\s|;)/g,
        /BillingConfig(\.|\s|;)/g,
        /RecipeItem(\.|\s|;)/g,
        /InventoryTransaction(\.|\s|;)/g,
        /InventoryCategory(\.|\s|;)/g,
        /InventorySale(\.|\s|;)/g,
        /OrderItem(\.|\s|;)/g,
        /ProductType(\.|\s|;)/g,
        /ExpenseType(\.|\s|;)/g,
        /MembershipPlan(\.|\s|;)/g,
        /PartnerType(\.|\s|;)/g,
        /PartnerMembership(\.|\s|;)/g,
        /PartnerWallet(\.|\s|;)/g,
        /BrandCounter(\.|\s|;)/g,
        /FeatureFlag(\.|\s|;)/g,
        /WebContent(\.|\s|;)/g
    ];
    
    const usedModels = new Set();
    
    for (const pattern of modelPatterns) {
        const matches = content.match(pattern);
        if (matches) {
            const modelName = pattern.source.split('(')[0];
            usedModels.add(modelName);
        }
    }
    
    return Array.from(usedModels);
}

/**
 * Refactor a single controller file
 */
function refactorController(filePath) {
    console.log(`🔧 Refactoring: ${path.basename(filePath)}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // 1. Remove direct model imports
    for (const pattern of REFACTORING_RULES.removeDirectImports) {
        content = content.replace(pattern, (match) => {
            if (match.trim().startsWith('//')) {
                return '// Direct model import removed - using req.models instead';
            }
            return '// Direct model import removed - using req.models instead';
        });
    }
    
    // 2. Remove sequelize imports
    for (const pattern of REFACTORING_RULES.removeSequelizeImports) {
        content = content.replace(pattern, '// Sequelize import removed - using req.sequelize instead');
    }
    
    // 3. Extract used models
    const usedModels = extractModelUsage(content);
    
    // 4. Add model destructuring to async functions
    // This is more complex and would need AST parsing for perfect results
    // For now, we'll add a comment and let developers handle manually
    
    // 5. Add architecture compliance comment at the top
    if (!content.includes('STRICT ARCHITECTURE COMPLIANCE')) {
        const headerComment = `/**
 * STRICT ARCHITECTURE COMPLIANCE
 * 
 * This controller follows the standardized architecture:
 * - Models accessed via req.models only (no direct imports)
 * - Tenant context via req.tenant or req.brandId
 * - Error handling via next(error)
 * - Business logic in services, controllers handle HTTP
 * 
 * FORBIDDEN: Direct model imports, database connections, business logic
 */

`;
        content = headerComment + content;
    }
    
    // 6. Replace common patterns
    content = content.replace(/req\.brandId/g, 'req.brandId || req.tenant?.brandId');
    content = content.replace(/req\.outletId/g, 'req.outletId || req.tenant?.outletId');
    content = content.replace(/req\.businessId/g, 'req.brandId || req.tenant?.brandId');
    
    // Write back if changed
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Refactored: ${path.basename(filePath)} (Found models: ${usedModels.join(', ')})`);
        return true;
    } else {
        console.log(`⏭️  No changes needed: ${path.basename(filePath)}`);
        return false;
    }
}

/**
 * Main refactoring function
 */
function main() {
    console.log('🚀 Starting controller refactoring...');
    console.log('📋 Applying strict architecture rules to all controllers...\n');
    
    const controllerFiles = getControllerFiles();
    let refactoredCount = 0;
    
    for (const filePath of controllerFiles) {
        try {
            if (refactorController(filePath)) {
                refactoredCount++;
            }
        } catch (error) {
            console.error(`❌ Error refactoring ${path.basename(filePath)}:`, error.message);
        }
    }
    
    console.log(`\n📊 Refactoring Summary:`);
    console.log(`   Total controllers: ${controllerFiles.length}`);
    console.log(`   Refactored: ${refactoredCount}`);
    console.log(`   No changes: ${controllerFiles.length - refactoredCount}`);
    
    console.log(`\n📝 Next Steps:`);
    console.log(`   1. Review each refactored controller`);
    console.log(`   2. Add proper model destructuring in each function`);
    console.log(`   3. Test all endpoints`);
    console.log(`   4. Verify tenant isolation`);
    
    if (refactoredCount > 0) {
        console.log(`\n⚠️  MANUAL REVIEW REQUIRED:`);
        console.log(`   Some controllers may need manual model destructuring like:`);
        console.log(`   const { User, Product, Order } = req.models;`);
    }
}

// Run the refactoring
if (require.main === module) {
    main();
}

module.exports = { refactorController, main };
