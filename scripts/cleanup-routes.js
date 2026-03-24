#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'routes');

// Files to clean up (remove duplicate middleware)
const filesToClean = [
  'accountingRoute.js',
  'areaRoute.js', 
  'dashboardRoute.js',
  'expenseTypeRoute.js',
  'inventoryRoute.js',
  'inventorySaleRoute.js',
  'orderRoute.js',
  'outletRoute.js',
  'paymentRoute.js',
  'purchaseRoute.js',
  'reportRoute.js',
  'tableRoute.js',
  'timingRoute.js',
  'userRoute.js'
];

// Patterns to remove
const patternsToRemove = [
  /const\s*\{\s*isVerifiedUser[^}]*\}\s*=\s*require\(["']\.\.\/middlewares\/tokenVerification["']\);?/g,
  /const\s*\{\s*tenantOnlyMiddleware[^}]*\}\s*=\s*require\(["']\.\.\/middlewares\/tokenVerification["']\);?/g,
  /const\s*\{\s*adminOnlyMiddleware[^}]*\}\s*=\s*require\(["']\.\.\/middlewares\/tokenVerification["']\);?/g,
  /const\s*tenantRoutingMiddleware\s*=\s*require\(["']\.\.\/middlewares\/tenantRouting["']\);?/g,
  /const\s*\{\s*setTenantContextMiddleware[^}]*\}\s*=\s*require\(["']\.\.\/src\/db\/getModelsForRequest["']\);?/g,
  /router\.use\s*\(\s*isVerifiedUser\s*\);?/g,
  /router\.use\s*\(\s*tenantRoutingMiddleware\s*\);?/g,
  /router\.use\s*\(\s*adminOnlyMiddleware\s*\);?/g,
  /router\.use\s*\(\s*tenantOnlyMiddleware\s*\);?/g,
  /router\.use\s*\(\s*setTenantContextMiddleware\s*\);?/g,
  /router\.use\s*\(\s*\(req,\s*res,\s*next\)\s*=>\s*\{[^}]*tenantRoutingMiddleware[^}]*\}\s*\);?/gs,
  /\/\/ Order:.*→.*controller/g
];

filesToClean.forEach(file => {
  const filePath = path.join(routesDir, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Remove patterns
  patternsToRemove.forEach(pattern => {
    content = content.replace(pattern, '');
  });
  
  // Clean up extra newlines
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Add comment about middleware being applied at app level
  if (content.includes('// Middleware is applied at app level') === false) {
    const routerLine = content.indexOf('const router = express.Router();');
    if (routerLine !== -1) {
      const insertPosition = content.indexOf('\n', routerLine) + 1;
      content = content.slice(0, insertPosition) + 
                '\n// Middleware is applied at app level: isVerifiedUser → tenantRoutingMiddleware → tenantOnlyMiddleware\n// No middleware needed here - routes are already protected\n' +
                content.slice(insertPosition);
    }
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Cleaned: ${file}`);
  } else {
    console.log(`No changes needed: ${file}`);
  }
});

console.log('Route cleanup completed!');
