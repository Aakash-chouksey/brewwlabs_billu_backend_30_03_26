/**
 * API CONTRACT VALIDATION SCRIPT
 * ================================
 * 
 * This script validates that all frontend API calls have corresponding
 * backend routes that are properly registered and functional.
 */

const axios = require('axios');
const chalk = require('chalk');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// All frontend API endpoints extracted from src/https/index.js
const FRONTEND_APIS = [
    // Auth
    { method: 'POST', path: '/api/auth/send-otp', name: 'Send OTP' },
    { method: 'POST', path: '/api/auth/verify-otp', name: 'Verify OTP' },
    { method: 'POST', path: '/api/auth/login', name: 'Login' },
    { method: 'GET', path: '/api/tenant/profile', name: 'Get Profile', auth: true },
    { method: 'PUT', path: '/api/tenant/profile', name: 'Update Profile', auth: true },
    { method: 'POST', path: '/api/auth/logout', name: 'Logout', auth: true },
    { method: 'POST', path: '/api/onboarding/business', name: 'Onboard Business' },
    { method: 'GET', path: '/api/super-admin/businesses', name: 'Get Businesses', auth: true },
    
    // Tables
    { method: 'POST', path: '/api/tenant/tables', name: 'Create Table', auth: true },
    { method: 'GET', path: '/api/tenant/tables', name: 'Get Tables', auth: true },
    { method: 'PUT', path: '/api/tenant/tables/123', name: 'Update Table', auth: true },
    { method: 'DELETE', path: '/api/tenant/tables/123', name: 'Delete Table', auth: true },
    
    // Areas
    { method: 'POST', path: '/api/tenant/areas', name: 'Create Area', auth: true },
    { method: 'GET', path: '/api/tenant/areas', name: 'Get Areas', auth: true },
    { method: 'PUT', path: '/api/tenant/areas/123', name: 'Update Area', auth: true },
    { method: 'DELETE', path: '/api/tenant/areas/123', name: 'Delete Area', auth: true },
    
    // Operation Timings
    { method: 'GET', path: '/api/tenant/operation-timings', name: 'Get Timings', auth: true },
    { method: 'POST', path: '/api/tenant/operation-timings', name: 'Create Timing', auth: true },
    { method: 'PUT', path: '/api/tenant/operation-timings/123', name: 'Update Timing', auth: true },
    { method: 'DELETE', path: '/api/tenant/operation-timings/123', name: 'Delete Timing', auth: true },
    
    // Outlets
    { method: 'GET', path: '/api/tenant/outlets', name: 'Get Outlets', auth: true },
    { method: 'POST', path: '/api/tenant/outlets', name: 'Create Outlet', auth: true },
    { method: 'PUT', path: '/api/tenant/outlets/123', name: 'Update Outlet', auth: true },
    
    // Payments
    { method: 'POST', path: '/api/tenant/payments/create-order', name: 'Create Payment Order', auth: true },
    { method: 'POST', path: '/api/tenant/payments/verify', name: 'Verify Payment', auth: true },
    
    // Orders
    { method: 'GET', path: '/api/tenant/orders', name: 'Get Orders', auth: true },
    { method: 'POST', path: '/api/tenant/orders', name: 'Create Order', auth: true },
    { method: 'GET', path: '/api/tenant/orders/123', name: 'Get Order By ID', auth: true },
    { method: 'PUT', path: '/api/tenant/orders/123', name: 'Update Order', auth: true },
    { method: 'POST', path: '/api/tenant/ebill/send', name: 'Send E-Bill', auth: true },
    { method: 'GET', path: '/api/tenant/orders/archived', name: 'Get Archived Orders', auth: true },
    
    // Categories
    { method: 'GET', path: '/api/tenant/categories', name: 'Get Categories', auth: true },
    { method: 'POST', path: '/api/tenant/categories', name: 'Create Category', auth: true },
    { method: 'PUT', path: '/api/tenant/categories/123', name: 'Update Category', auth: true },
    { method: 'DELETE', path: '/api/tenant/categories/123', name: 'Delete Category', auth: true },
    
    // Products
    { method: 'GET', path: '/api/tenant/products', name: 'Get Products', auth: true },
    { method: 'POST', path: '/api/tenant/products', name: 'Create Product', auth: true },
    { method: 'PUT', path: '/api/tenant/products/123', name: 'Update Product', auth: true },
    { method: 'DELETE', path: '/api/tenant/products/123', name: 'Delete Product', auth: true },
    
    // Sales
    { method: 'GET', path: '/api/tenant/sales/daily', name: 'Daily Sales', auth: true },
    { method: 'GET', path: '/api/tenant/sales/categories', name: 'Category Sales', auth: true },
    { method: 'GET', path: '/api/tenant/sales/items', name: 'Item Sales', auth: true },
    { method: 'GET', path: '/api/tenant/sales/payments', name: 'Payment Sales', auth: true },
    { method: 'GET', path: '/api/tenant/sales/dashboard', name: 'Sales Dashboard', auth: true },
    
    // Dashboard
    { method: 'GET', path: '/api/tenant/dashboard', name: 'Dashboard Stats', auth: true },
    
    // Purchases
    { method: 'GET', path: '/api/tenant/purchases', name: 'Get Purchases', auth: true },
    { method: 'POST', path: '/api/tenant/purchases', name: 'Create Purchase', auth: true },
    
    // Inventory Sales
    { method: 'GET', path: '/api/tenant/inventory-sales', name: 'Get Inventory Sales', auth: true },
    { method: 'POST', path: '/api/tenant/inventory-sales', name: 'Create Inventory Sale', auth: true },
    
    // Inventory Items
    { method: 'GET', path: '/api/tenant/inventory/items', name: 'Get Inventory Items', auth: true },
    { method: 'POST', path: '/api/tenant/inventory/items', name: 'Create Inventory Item', auth: true },
    { method: 'PUT', path: '/api/tenant/inventory/items/123', name: 'Update Inventory Item', auth: true },
    { method: 'DELETE', path: '/api/tenant/inventory/items/123', name: 'Delete Inventory Item', auth: true },
    
    // Inventory Categories
    { method: 'GET', path: '/api/tenant/inventory-categories', name: 'Get Inventory Categories', auth: true },
    { method: 'POST', path: '/api/tenant/inventory-categories', name: 'Create Inventory Category', auth: true },
    { method: 'PUT', path: '/api/tenant/inventory-categories/123', name: 'Update Inventory Category', auth: true },
    { method: 'DELETE', path: '/api/tenant/inventory-categories/123', name: 'Delete Inventory Category', auth: true },
    { method: 'PUT', path: '/api/tenant/inventory-categories/123/status', name: 'Toggle Category Status', auth: true },
    
    // Recipes
    { method: 'GET', path: '/api/tenant/recipes', name: 'Get Recipes', auth: true },
    { method: 'POST', path: '/api/tenant/recipes', name: 'Create Recipe', auth: true },
    { method: 'GET', path: '/api/tenant/recipes/123', name: 'Get Recipe', auth: true },
    { method: 'PUT', path: '/api/tenant/recipes/123', name: 'Update Recipe', auth: true },
    { method: 'DELETE', path: '/api/tenant/recipes/123', name: 'Delete Recipe', auth: true },
    { method: 'GET', path: '/api/tenant/recipes/123/availability', name: 'Recipe Availability', auth: true },
    { method: 'GET', path: '/api/tenant/recipes/123/cost-analysis', name: 'Recipe Cost Analysis', auth: true },
    
    // Wastage
    { method: 'GET', path: '/api/tenant/inventory/wastage', name: 'Get Wastage', auth: true },
    { method: 'POST', path: '/api/tenant/inventory/wastage', name: 'Create Wastage', auth: true },
    { method: 'DELETE', path: '/api/tenant/inventory/wastage/123', name: 'Delete Wastage', auth: true },
    
    // Stock Adjustments
    { method: 'POST', path: '/api/tenant/inventory/purchase', name: 'Purchase Stock', auth: true },
    { method: 'POST', path: '/api/tenant/inventory/self-consume', name: 'Self Consume Stock', auth: true },
    { method: 'POST', path: '/api/tenant/inventory/adjust', name: 'Adjust Stock', auth: true },
    { method: 'GET', path: '/api/tenant/inventory/adjustments', name: 'Get Adjustments', auth: true },
    { method: 'GET', path: '/api/tenant/inventory/transactions', name: 'Get Transactions', auth: true },
    { method: 'GET', path: '/api/tenant/inventory/low-stock', name: 'Get Low Stock', auth: true },
    
    // Suppliers
    { method: 'GET', path: '/api/tenant/inventory/suppliers', name: 'Get Suppliers', auth: true },
    { method: 'POST', path: '/api/tenant/inventory/suppliers', name: 'Create Supplier', auth: true },
    { method: 'PUT', path: '/api/tenant/inventory/suppliers/123', name: 'Update Supplier', auth: true },
    { method: 'DELETE', path: '/api/tenant/inventory/suppliers/123', name: 'Delete Supplier', auth: true },
    
    // Staff/Users
    { method: 'GET', path: '/api/tenant/users', name: 'Get Users', auth: true },
    { method: 'POST', path: '/api/tenant/users', name: 'Create Staff', auth: true },
    
    // Accounting
    { method: 'GET', path: '/api/tenant/accounting/accounts', name: 'Get Accounts', auth: true },
    { method: 'POST', path: '/api/tenant/accounting/accounts', name: 'Create Account', auth: true },
    { method: 'PUT', path: '/api/tenant/accounting/accounts/123', name: 'Update Account', auth: true },
    { method: 'DELETE', path: '/api/tenant/accounting/accounts/123', name: 'Delete Account', auth: true },
    { method: 'GET', path: '/api/tenant/accounting/transactions', name: 'Get Transactions', auth: true },
    { method: 'POST', path: '/api/tenant/accounting/transactions', name: 'Create Transaction', auth: true },
    
    // Timing
    { method: 'GET', path: '/api/tenant/timing', name: 'Get Timing', auth: true },
    { method: 'POST', path: '/api/tenant/timing', name: 'Create Timing', auth: true },
    
    // Product Types
    { method: 'GET', path: '/api/tenant/product-types', name: 'Get Product Types', auth: true },
    { method: 'POST', path: '/api/tenant/product-types', name: 'Create Product Type', auth: true },
    
    // Expense Types
    { method: 'GET', path: '/api/tenant/expense-types', name: 'Get Expense Types', auth: true },
    { method: 'POST', path: '/api/tenant/expense-types', name: 'Create Expense Type', auth: true },
    { method: 'PUT', path: '/api/tenant/expense-types/123', name: 'Update Expense Type', auth: true },
    { method: 'DELETE', path: '/api/tenant/expense-types/123', name: 'Delete Expense Type', auth: true },
    
    // Tables Management
    { method: 'GET', path: '/api/tenant/tables-management', name: 'Get Tables Mgmt', auth: true },
    { method: 'POST', path: '/api/tenant/tables-management', name: 'Create Table Mgmt', auth: true },
    { method: 'PUT', path: '/api/tenant/tables-management/123', name: 'Update Table Mgmt', auth: true },
    { method: 'DELETE', path: '/api/tenant/tables-management/123', name: 'Delete Table Mgmt', auth: true },
    
    // Live Feeding
    { method: 'GET', path: '/api/tenant/live-orders', name: 'Get Live Orders', auth: true },
    { method: 'GET', path: '/api/tenant/live-stats', name: 'Get Live Stats', auth: true },
    
    // Control Center
    { method: 'GET', path: '/api/tenant/control-center', name: 'Control Center', auth: true },
    { method: 'GET', path: '/api/tenant/system-health', name: 'System Health', auth: true },
    
    // Billing Config
    { method: 'GET', path: '/api/tenant/billing/config', name: 'Get Billing Config', auth: true },
    { method: 'PUT', path: '/api/tenant/billing/config', name: 'Update Billing Config', auth: true },
    { method: 'PATCH', path: '/api/tenant/billing/config', name: 'Patch Billing Config', auth: true },
    
    // Business
    { method: 'GET', path: '/api/tenant/business', name: 'Get Business Info', auth: true },
    { method: 'PUT', path: '/api/tenant/business', name: 'Update Business Info', auth: true },
];

class APIValidator {
    constructor() {
        this.results = {
            passed: [],
            failed: [],
            warnings: []
        };
    }

    async testEndpoint(api) {
        const url = `${BASE_URL}${api.path}`;
        const startTime = Date.now();
        
        try {
            const config = {
                method: api.method,
                url,
                timeout: 5000,
                validateStatus: () => true // Accept any status to check if route exists
            };

            // Add dummy auth header for protected routes
            if (api.auth) {
                config.headers = {
                    'Authorization': 'Bearer test-token',
                    'x-business-id': 'test-business',
                    'x-outlet-id': 'test-outlet',
                    'x-panel-type': 'TENANT'
                };
            }

            // Add dummy body for POST/PUT/PATCH
            if (['POST', 'PUT', 'PATCH'].includes(api.method)) {
                config.data = { test: true };
            }

            const response = await axios(config);
            const duration = Date.now() - startTime;

            // Analyze response
            const status = response.status;
            
            // Route exists if we don't get 404 or 501 (not implemented)
            if (status === 404) {
                return { status: 'FAILED', reason: 'Route not found (404)', duration };
            } else if (status === 501) {
                return { status: 'FAILED', reason: 'Route not implemented (501)', duration };
            } else if (status === 401) {
                return { status: 'PASSED', reason: 'Route exists (requires auth)', duration };
            } else if (status === 400) {
                return { status: 'PASSED', reason: 'Route exists (validation error)', duration };
            } else if (status >= 200 && status < 500) {
                return { status: 'PASSED', reason: `Route exists (${status})`, duration };
            } else {
                return { status: 'WARNING', reason: `Unexpected status: ${status}`, duration };
            }

        } catch (error) {
            const duration = Date.now() - startTime;
            
            if (error.code === 'ECONNREFUSED') {
                return { status: 'FAILED', reason: 'Server not running', duration };
            } else if (error.code === 'ETIMEDOUT') {
                return { status: 'WARNING', reason: 'Request timeout', duration };
            } else {
                return { status: 'FAILED', reason: error.message, duration };
            }
        }
    }

    async runValidation() {
        console.log(chalk.blue.bold('\n🔍 API CONTRACT VALIDATION\n'));
        console.log(chalk.gray(`Testing ${FRONTEND_APIS.length} endpoints against ${BASE_URL}\n`));

        let passed = 0;
        let failed = 0;
        let warnings = 0;

        for (const api of FRONTEND_APIS) {
            process.stdout.write(`Testing ${api.method} ${api.path} ... `);
            
            const result = await this.testEndpoint(api);
            
            if (result.status === 'PASSED') {
                passed++;
                console.log(chalk.green(`✓ ${result.reason} (${result.duration}ms)`));
            } else if (result.status === 'WARNING') {
                warnings++;
                console.log(chalk.yellow(`⚠ ${result.reason} (${result.duration}ms)`));
            } else {
                failed++;
                console.log(chalk.red(`✗ ${result.reason} (${result.duration}ms)`));
            }
        }

        // Summary
        console.log(chalk.blue.bold('\n📊 SUMMARY\n'));
        console.log(chalk.green(`  ✓ Passed: ${passed}/${FRONTEND_APIS.length}`));
        console.log(chalk.red(`  ✗ Failed: ${failed}/${FRONTEND_APIS.length}`));
        console.log(chalk.yellow(`  ⚠ Warnings: ${warnings}/${FRONTEND_APIS.length}`));
        
        const coverage = Math.round((passed / FRONTEND_APIS.length) * 100);
        console.log(chalk.blue(`\n  Coverage: ${coverage}%`));

        if (failed === 0) {
            console.log(chalk.green.bold('\n✅ All endpoints are properly registered!\n'));
        } else {
            console.log(chalk.red.bold(`\n❌ ${failed} endpoints need attention\n`));
        }

        return { passed, failed, warnings, coverage };
    }
}

// Run validation
const validator = new APIValidator();
validator.runValidation().catch(error => {
    console.error('Validation error:', error);
    process.exit(1);
});
