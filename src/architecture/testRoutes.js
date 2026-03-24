/**
 * Quick test to verify route loading
 */

const path = require('path');

console.log('Testing route paths...\n');

// Test getRoutePath logic
const getRoutePath = (relativePath) => {
    return path.join(__dirname, '..', '..', relativePath);
};

const testPaths = [
    'routes/onboardingRoute.js',
    'routes/tenant/tenant.routes.js',
    'src/auth/auth.routes.js'
];

testPaths.forEach(p => {
    const fullPath = getRoutePath(p);
    console.log(`${p}`);
    console.log(`  -> ${fullPath}`);
    try {
        const resolved = require.resolve(fullPath);
        console.log(`  ✅ Found: ${resolved}`);
    } catch(e) {
        console.log(`  ❌ Not found: ${e.message}`);
    }
    console.log();
});
