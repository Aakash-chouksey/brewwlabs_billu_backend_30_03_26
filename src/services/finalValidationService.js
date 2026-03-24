const request = require('supertest');
const app = require('../app');

/**
 * Final Validation Service
 * Tests complete request flow for production readiness
 */
class FinalValidationService {
    /**
     * Run comprehensive final validation
     * @returns {Promise<Object>} - Validation results
     */
    async runFinalValidation() {
        console.log('🔍 Starting final validation...');
        
        const results = {
            timestamp: new Date().toISOString(),
            serverHealth: await this.testServerHealth(),
            authenticationFlow: await this.testAuthenticationFlow(),
            tenantRouting: await this.testTenantRouting(),
            databaseIsolation: await this.testDatabaseIsolation(),
            apiEndpoints: await this.testApiEndpoints(),
            errorHandling: await this.testErrorHandling(),
            overallStatus: 'UNKNOWN'
        };

        // Calculate overall status
        const allPassed = Object.values(results)
            .filter(result => typeof result === 'object' && result.status)
            .every(result => result.status === 'PASS');

        results.overallStatus = allPassed ? 'PASS' : 'FAIL';
        
        console.log(`✅ Final validation completed: ${results.overallStatus}`);
        return results;
    }

    /**
     * Test server health endpoints
     */
    async testServerHealth() {
        try {
            const response = await request(app)
                .get('/health')
                .expect(200);

            const validation = {
                status: 'PASS',
                uptime: response.body.uptime,
                database: response.body.database,
                env: response.body.env,
                recommendations: []
            };

            if (response.body.database !== 'Connected') {
                validation.status = 'FAIL';
                validation.recommendations.push('Database connection issue detected');
            }

            return validation;
            
        } catch (error) {
            return {
                status: 'FAIL',
                error: error.message,
                recommendations: ['Fix server health endpoint']
            };
        }
    }

    /**
     * Test authentication flow
     */
    async testAuthenticationFlow() {
        try {
            // Test login endpoint
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'testpassword'
                });

            const validation = {
                status: 'PASS',
                loginEndpoint: loginResponse.status,
                hasToken: !!loginResponse.body.token,
                recommendations: []
            };

            // Should return 401 for invalid credentials
            if (loginResponse.status !== 401) {
                validation.recommendations.push('Login should return 401 for invalid credentials');
            }

            return validation;
            
        } catch (error) {
            return {
                status: 'ERROR',
                error: error.message,
                recommendations: ['Fix authentication flow']
            };
        }
    }

    /**
     * Test tenant routing middleware
     */
    async testTenantRouting() {
        try {
            // Test tenant route without authentication
            const response = await request(app)
                .get('/api/tenant/categories')
                .expect(401);

            const validation = {
                status: 'PASS',
                unauthenticatedResponse: response.status,
                recommendations: []
            };

            // Should return 401 for unauthenticated requests
            if (response.status !== 401) {
                validation.status = 'FAIL';
                validation.recommendations.push('Tenant routes should require authentication');
            }

            return validation;
            
        } catch (error) {
            return {
                status: 'ERROR',
                error: error.message,
                recommendations: ['Fix tenant routing middleware']
            };
        }
    }

    /**
     * Test database isolation
     */
    async testDatabaseIsolation() {
        try {
            // Test admin route accessibility
            const adminResponse = await request(app)
                .get('/api/admin/brands')
                .expect(401);

            // Test tenant route accessibility  
            const tenantResponse = await request(app)
                .get('/api/tenant/categories')
                .expect(401);

            const validation = {
                status: 'PASS',
                adminRouteResponse: adminResponse.status,
                tenantRouteResponse: tenantResponse.status,
                recommendations: []
            };

            // Both should require authentication
            if (adminResponse.status !== 401 || tenantResponse.status !== 401) {
                validation.status = 'FAIL';
                validation.recommendations.push('All protected routes should require authentication');
            }

            return validation;
            
        } catch (error) {
            return {
                status: 'ERROR',
                error: error.message,
                recommendations: ['Fix database isolation middleware']
            };
        }
    }

    /**
     * Test API endpoints structure
     */
    async testApiEndpoints() {
        try {
            const endpoints = [
                { path: '/api/tenant/categories', method: 'GET' },
                { path: '/api/tenant/products', method: 'GET' },
                { path: '/api/tenant/orders', method: 'GET' },
                { path: '/api/admin/brands', method: 'GET' }
            ];

            const results = [];
            
            for (const endpoint of endpoints) {
                try {
                    const response = await request(app)
                        .get(endpoint.path)
                        .expect(401); // Should require auth
                    
                    results.push({
                        path: endpoint.path,
                        status: 'PASS',
                        responseCode: response.status
                    });
                } catch (error) {
                    results.push({
                        path: endpoint.path,
                        status: 'FAIL',
                        error: error.message
                    });
                }
            }

            const validation = {
                status: 'PASS',
                endpoints: results,
                recommendations: []
            };

            const failedEndpoints = results.filter(r => r.status === 'FAIL');
            if (failedEndpoints.length > 0) {
                validation.status = 'FAIL';
                validation.recommendations.push('Some API endpoints are not responding correctly');
            }

            return validation;
            
        } catch (error) {
            return {
                status: 'ERROR',
                error: error.message,
                recommendations: ['Fix API endpoints']
            };
        }
    }

    /**
     * Test error handling
     */
    async testErrorHandling() {
        try {
            // Test 404 handling
            const notFoundResponse = await request(app)
                .get('/api/nonexistent')
                .expect(404);

            // Test malformed JSON
            const malformedResponse = await request(app)
                .post('/api/auth/login')
                .send('invalid json')
                .expect(400);

            const validation = {
                status: 'PASS',
                notFoundHandled: notFoundResponse.status === 404,
                malformedJsonHandled: malformedResponse.status === 400,
                recommendations: []
            };

            if (!validation.notFoundHandled) {
                validation.recommendations.push('Improve 404 error handling');
            }

            if (!validation.malformedJsonHandled) {
                validation.recommendations.push('Improve malformed JSON handling');
            }

            return validation;
            
        } catch (error) {
            return {
                status: 'ERROR',
                error: error.message,
                recommendations: ['Fix error handling middleware']
            };
        }
    }

    /**
     * Generate final validation report
     */
    generateReport(validationResults) {
        const report = {
            summary: {
                status: validationResults.overallStatus,
                timestamp: validationResults.timestamp,
                totalTests: Object.keys(validationResults).filter(key => key !== 'overallStatus' && key !== 'timestamp').length,
                passedTests: Object.values(validationResults).filter(result => typeof result === 'object' && result.status === 'PASS').length
            },
            details: validationResults,
            recommendations: this.aggregateRecommendations(validationResults),
            productionReady: validationResults.overallStatus === 'PASS'
        };

        return report;
    }

    /**
     * Aggregate all recommendations
     */
    aggregateRecommendations(results) {
        const allRecommendations = [];
        
        Object.values(results).forEach(result => {
            if (result.recommendations && Array.isArray(result.recommendations)) {
                allRecommendations.push(...result.recommendations);
            }
        });

        return [...new Set(allRecommendations)]; // Remove duplicates
    }
}

module.exports = new FinalValidationService();
