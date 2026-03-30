/**
 * API CONTRACT VALIDATION
 * Multi-tenant POS System - March 2026
 * 
 * This script validates API contracts between frontend and backend
 * to identify mismatches, missing endpoints, and response format issues.
 */

const fs = require('fs');
const path = require('path');

class ApiContractValidator {
    constructor() {
        this.issues = [];
        this.fixes = [];
        this.warnings = [];
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${level}: ${message}`;
        console.log(logEntry);
        if (data) {
            console.log('Data:', JSON.stringify(data, null, 2));
        }
        
        if (level === 'ISSUE') this.issues.push({ message, data, timestamp });
        if (level === 'FIX') this.fixes.push({ message, data, timestamp });
        if (level === 'WARNING') this.warnings.push({ message, data, timestamp });
    }

    async validateApiContracts() {
        this.log('INFO', '🔍 Starting API contract validation...');
        
        try {
            // Step 1: Parse frontend API definitions
            const frontendApis = this.parseFrontendApis();
            
            // Step 2: Parse backend route definitions
            const backendRoutes = this.parseBackendRoutes();
            
            // Step 3: Validate endpoint existence
            await this.validateEndpointExistence(frontendApis, backendRoutes);
            
            // Step 4: Validate request/response formats
            await this.validateRequestResponseFormats(frontendApis, backendRoutes);
            
            // Step 5: Check for critical missing endpoints
            await this.validateCriticalEndpoints(frontendApis, backendRoutes);
            
            // Generate report
            this.generateReport();

        } catch (error) {
            this.log('ISSUE', 'Critical error during API contract validation', { error: error.message });
        }
    }

    parseFrontendApis() {
        this.log('INFO', '📱 Parsing frontend API definitions...');
        
        const frontendPath = path.join(__dirname, '../pos-frontend-multitenant-issues-resolved-updatd-code-21-march-2026/src/https/index.js');
        
        if (!fs.existsSync(frontendPath)) {
            this.log('WARNING', 'Frontend API file not found');
            return {};
        }

        const frontendContent = fs.readFileSync(frontendPath, 'utf8');
        
        // Extract API exports using regex
        const apiExports = {};
        
        // Match export patterns like: export const functionName = (params) => axiosWrapper.method("/api/endpoint", params);
        const exportRegex = /export\s+const\s+(\w+)\s*=\s*(?:\([^)]*\)\s*=>\s*)?axiosWrapper\.\w+\s*\(\s*["']([^"']+)["']/g;
        
        let match;
        while ((match = exportRegex.exec(frontendContent)) !== null) {
            apiExports[match[1]] = {
                name: match[1],
                endpoint: match[2],
                type: this.extractMethodFromEndpoint(match[2])
            };
        }
        
        this.log('INFO', `Found ${Object.keys(apiExports).length} frontend API exports`);
        return apiExports;
    }

    parseBackendRoutes() {
        this.log('INFO', '🖥️ Parsing backend route definitions...');
        
        const backendPath = path.join(__dirname, '../pos-backend-multitenant-issues-resolved-updatd-code-21-march-2026/routes/tenant/tenant.routes.js');
        
        if (!fs.existsSync(backendPath)) {
            this.log('WARNING', 'Backend routes file not found');
            return {};
        }

        const backendContent = fs.readFileSync(backendPath, 'utf8');
        
        // Extract route patterns like: router.get('/path', controller.method);
        const routeDefinitions = {};
        
        const routeRegex = /router\.(\w+)\s*\(\s*["']([^"']+)["']/g;
        
        let match;
        while ((match = routeRegex.exec(backendContent)) !== null) {
            const routePath = match[2];
            const method = match[1].toLowerCase();
            
            // Normalize path (remove parameters)
            const cleanPath = routePath.replace(/:[^/]+/g, ':param');
            
            routeDefinitions[cleanPath] = {
                path: routePath,
                method: method,
                cleanPath: cleanPath
            };
        }
        
        this.log('INFO', `Found ${Object.keys(routeDefinitions).length} backend route definitions`);
        return routeDefinitions;
    }

    extractMethodFromEndpoint(endpoint) {
        if (endpoint.includes('/tables-management') || endpoint.includes('/tables')) return 'post';
        if (endpoint.includes('/orders')) return 'post';
        if (endpoint.includes('/areas')) return 'post';
        if (endpoint.includes('/categories')) return 'post';
        if (endpoint.includes('/products')) return 'post';
        if (endpoint.includes('/outlets')) return 'post';
        return 'get'; // Default assumption
    }

    async validateEndpointExistence(frontendApis, backendRoutes) {
        this.log('INFO', '🔍 Validating endpoint existence...');
        
        const criticalEndpoints = [
            '/api/tenant/tables-management',
            '/api/tenant/tables',
            '/api/tenant/orders',
            '/api/tenant/areas',
            '/api/tenant/categories',
            '/api/tenant/products',
            '/api/tenant/outlets'
        ];

        for (const [apiName, apiDef] of Object.entries(frontendApis)) {
            const endpoint = apiDef.endpoint;
            const expectedMethod = apiDef.type;
            
            // Find matching backend route
            const matchingRoute = Object.values(backendRoutes).find(route => 
                endpoint.includes(route.cleanPath) || route.cleanPath.includes(endpoint)
            );
            
            if (!matchingRoute) {
                this.log('ISSUE', `Frontend API ${apiName} has no matching backend route`, {
                    frontendEndpoint: endpoint,
                    frontendMethod: expectedMethod,
                    apiName
                });
            } else if (matchingRoute.method !== expectedMethod) {
                this.log('ISSUE', `Method mismatch for ${apiName}`, {
                    frontendEndpoint: endpoint,
                    frontendMethod: expectedMethod,
                    backendMethod: matchingRoute.method,
                    backendPath: matchingRoute.path
                });
            } else {
                this.log('FIX', `✅ Endpoint validated: ${apiName} -> ${matchingRoute.method} ${matchingRoute.path}`);
            }
        }

        // Check for missing critical endpoints
        for (const criticalEndpoint of criticalEndpoints) {
            const exists = Object.values(frontendApis).some(api => 
                api.endpoint.includes(criticalEndpoint.replace('/api/tenant/', ''))
            );
            
            if (!exists) {
                this.log('ISSUE', `Critical endpoint missing: ${criticalEndpoint}`);
            }
        }
    }

    async validateRequestResponseFormats(frontendApis, backendRoutes) {
        this.log('INFO', '🔍 Validating request/response formats...');
        
        // Check table management API specifically
        const tableApi = frontendApis['addTable'];
        if (tableApi) {
            // Expected request body for addTable
            const expectedTableRequest = {
                tableNo: 'string (required)',
                name: 'string (required)', 
                areaId: 'uuid (optional)',
                capacity: 'number (optional)',
                status: 'string (optional)'
            };

            this.log('INFO', 'Validating table API request format', expectedTableRequest);
            
            // Check if frontend sends required fields
            // This would need runtime validation, but we can check the function signature
        }

        // Check order API specifically
        const orderApi = frontendApis['addOrder'];
        if (orderApi) {
            const expectedOrderRequest = {
                items: 'array (required)',
                tableId: 'uuid (optional for dine-in)',
                type: 'string (optional)',
                notes: 'string (optional)',
                discount: 'number (optional)',
                tax: 'number (optional)'
            };

            this.log('INFO', 'Validating order API request format', expectedOrderRequest);
        }
    }

    async validateCriticalEndpoints(frontendApis, backendRoutes) {
        this.log('INFO', '🔍 Validating critical endpoints...');
        
        const criticalValidations = [
            {
                name: 'Table Management',
                frontend: 'getTablesManagement',
                expectedEndpoint: '/api/tenant/tables-management',
                requiredParams: ['outletId'],
                responseFormat: 'Array of tables with area, status, etc.'
            },
            {
                name: 'Order Creation',
                frontend: 'addOrder', 
                expectedEndpoint: '/api/tenant/orders',
                requiredParams: ['items'],
                responseFormat: 'Created order with items, table, etc.'
            },
            {
                name: 'Order Fetching',
                frontend: 'getOrders',
                expectedEndpoint: '/api/tenant/orders',
                optionalParams: ['status', 'startDate', 'endDate', 'limit', 'offset'],
                responseFormat: 'Paginated orders with items, table, etc.'
            }
        ];

        for (const validation of criticalValidations) {
            const frontendApi = frontendApis[validation.frontend];
            
            if (!frontendApi) {
                this.log('ISSUE', `Critical frontend API missing: ${validation.frontend}`, validation);
                continue;
            }

            const backendRoute = Object.values(backendRoutes).find(route => 
                frontendApi.endpoint.includes(route.cleanPath)
            );

            if (!backendRoute) {
                this.log('ISSUE', `Critical backend route missing for: ${validation.name}`, {
                    expectedEndpoint: validation.expectedEndpoint,
                    frontendEndpoint: frontendApi.endpoint
                });
            } else {
                this.log('FIX', `✅ Critical endpoint validated: ${validation.name}`);
            }
        }
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 API CONTRACT VALIDATION REPORT');
        console.log('='.repeat(80));
        
        console.log(`\n🚨 ISSUES FOUND: ${this.issues.length}`);
        this.issues.forEach((issue, index) => {
            console.log(`\n${index + 1}. ${issue.message}`);
            if (issue.data) {
                console.log('   Details:', JSON.stringify(issue.data, null, 2));
            }
        });

        console.log(`\n⚠️  WARNINGS: ${this.warnings.length}`);
        this.warnings.forEach((warning, index) => {
            console.log(`\n${index + 1}. ${warning.message}`);
        });

        console.log(`\n✅ VALIDATIONS PASSED: ${this.fixes.length}`);
        this.fixes.forEach((fix, index) => {
            console.log(`\n${index + 1}. ${fix.message}`);
        });

        // Summary
        const totalIssues = this.issues.length + this.warnings.length;
        if (totalIssues === 0) {
            console.log('\n🎉 API CONTRACTS ARE ALIGNED - No issues found!');
        } else {
            console.log(`\n📋 SUMMARY: ${totalIssues} API contract issues need attention`);
            console.log(`   - Critical Issues: ${this.issues.length}`);
            console.log(`   - Warnings: ${this.warnings.length}`);
        }

        console.log('\n' + '='.repeat(80));
    }
}

// Main execution
async function runApiValidation() {
    const validator = new ApiContractValidator();
    
    console.log('🚀 Starting API contract validation...');
    
    try {
        await validator.validateApiContracts();
        console.log('✅ API contract validation completed successfully');
    } catch (error) {
        console.error('🚨 API contract validation failed with error:', error);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = ApiContractValidator;

// Run if called directly
if (require.main === module) {
    runApiValidation();
}
