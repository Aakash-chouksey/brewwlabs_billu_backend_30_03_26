/**
 * STEP 8: API TEST SUITE
 * 
 * Tests critical API endpoints for 200 OK and data shape.
 */

const colors = require('colors');
const http = require('http');

class APITestSuite {
    static async execute(config) {
        console.log(colors.cyan('  → Running API test suite...'));
        
        const results = {
            success: true,
            testsRun: 0,
            testsPassed: 0,
            results: [],
            issues: []
        };

        const baseURL = process.env.API_BASE_URL || 'http://localhost:8000';
        const endpoints = [
            { method: 'GET', path: '/api/tenant/dashboard', name: 'Dashboard' },
            { method: 'GET', path: '/api/tenant/products', name: 'Products' },
            { method: 'GET', path: '/api/tenant/orders', name: 'Orders' },
            { method: 'GET', path: '/api/tenant/inventory/items', name: 'Inventory' }
        ];

        for (const endpoint of endpoints) {
            results.testsRun++;
            const testResult = await this.testEndpoint(baseURL, endpoint, config.token);
            results.results.push(testResult);

            if (testResult.status === 200) {
                results.testsPassed++;
                console.log(colors.gray(`    ✓ ${endpoint.name} endpoint returned 200 OK (${testResult.duration}ms)`));
            } else {
                results.success = false;
                results.issues.push({
                    severity: 'CRITICAL',
                    message: `API endpoint '${endpoint.name}' failed with status ${testResult.status}`,
                    details: { endpoint, error: testResult.error }
                });
                console.log(colors.red(`    ✗ ${endpoint.name} endpoint FAILED with status ${testResult.status}`));
            }
        }

        if (results.success) {
            console.log(colors.green(`  ✓ Step 8: API test suite PASSED (${results.testsPassed}/${results.testsRun})`));
        }

        return results;
    }

    static async testEndpoint(baseURL, endpoint, token) {
        const startTime = Date.now();
        return new Promise((resolve) => {
            const url = new URL(endpoint.path, baseURL);
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: endpoint.method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-Panel-Type': 'TENANT'
                },
                timeout: 5000
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    let parsedData = null;
                    try { parsedData = data ? JSON.parse(data) : null; } catch (e) { parsedData = data; }
                    
                    resolve({
                        name: endpoint.name,
                        status: res.statusCode,
                        duration: Date.now() - startTime,
                        data: parsedData,
                        error: res.statusCode !== 200 ? data : null
                    });
                });
            });

            req.on('error', (err) => {
                resolve({
                    name: endpoint.name,
                    status: 500,
                    duration: Date.now() - startTime,
                    error: err.message
                });
            });

            req.end();
        });
    }
}

module.exports = APITestSuite;
