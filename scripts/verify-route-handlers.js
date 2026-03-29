#!/usr/bin/env node
/**
 * Route Handler Verification Script
 * Checks that all route handlers are properly defined
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking tenant route handlers...\n');

// Read the tenant routes file
const routesFile = fs.readFileSync('./routes/tenant/tenant.routes.js', 'utf8');

// Extract all controller imports
const importRegex = /const\s+(\w+)Controller\s+=\s+require\('([^']+)'\);/g;
const imports = {};
let match;

while ((match = importRegex.exec(routesFile)) !== null) {
    const [, varName, requirePath] = match;
    imports[varName] = requirePath;
}

console.log('📦 Controller Imports:');
Object.entries(imports).forEach(([name, path]) => {
    console.log(`  ${name}: ${path}`);
});

// Extract all route registrations
const routeRegex = /router\.(get|post|put|delete)\(['"]([^'"]+)['"],\s*(\w+Controller\.\w+|[a-zA-Z_]+)\);/g;
const routes = [];

while ((match = routeRegex.exec(routesFile)) !== null) {
    const [, method, routePath, handler] = match;
    routes.push({ method, path: routePath, handler });
}

console.log('\n🛣️  Routes:');
routes.forEach(({ method, path, handler }) => {
    console.log(`  ${method.toUpperCase()} ${path} -> ${handler}`);
});

// Now verify each handler exists
console.log('\n✅ Verifying handlers exist...\n');

const issues = [];

// Check each controller
Object.entries(imports).forEach(([varName, requirePath]) => {
    try {
        const fullPath = path.resolve('./routes/tenant', requirePath);
        const controller = require(fullPath);
        
        // Find all handlers for this controller
        const controllerRoutes = routes.filter(r => r.handler.startsWith(varName + '.'));
        
        controllerRoutes.forEach(({ method, path: routePath, handler }) => {
            const methodName = handler.split('.')[1];
            if (typeof controller[methodName] !== 'function' && typeof controller[methodName] === 'undefined') {
                issues.push({
                    controller: varName,
                    method: methodName,
                    route: `${method.toUpperCase()} ${routePath}`,
                    issue: 'Handler method is undefined'
                });
            } else if (typeof controller[methodName] !== 'function') {
                issues.push({
                    controller: varName,
                    method: methodName,
                    route: `${method.toUpperCase()} ${routePath}`,
                    issue: `Handler is ${typeof controller[methodName]}, not a function`
                });
            }
        });
        
    } catch (error) {
        issues.push({
            controller: varName,
            issue: `Failed to load controller: ${error.message}`
        });
    }
});

if (issues.length > 0) {
    console.log('❌ ISSUES FOUND:\n');
    issues.forEach((issue, i) => {
        console.log(`${i + 1}. Controller: ${issue.controller}`);
        if (issue.method) console.log(`   Method: ${issue.method}`);
        if (issue.route) console.log(`   Route: ${issue.route}`);
        console.log(`   Issue: ${issue.issue}`);
        console.log('');
    });
    process.exit(1);
} else {
    console.log('✅ All route handlers are properly defined!');
    process.exit(0);
}
