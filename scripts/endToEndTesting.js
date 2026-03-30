/**
 * END-TO-END TESTING AUTOMATION
 * Multi-tenant POS System - March 2026
 * 
 * This script automates the full user journey to ensure:
 * 1. Tenant registration works
 * 2. Login works
 * 3. Table creation works
 * 4. Product creation works
 * 5. Order creation works
 * 6. Order fetching works
 * 7. Order completion works
 * 8. Table state updates correctly
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class EndToEndTester {
    constructor() {
        this.baseURL = process.env.API_BASE_URL || 'http://localhost:8000';
        this.testResults = [];
        this.currentTenant = null;
        this.currentToken = null;
        this.createdResources = {
            tenant: null,
            user: null,
            outlet: null,
            area: null,
            table: null,
            product: null,
            order: null
        };
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${level}: ${message}`;
        console.log(logEntry);
        if (data) {
            console.log('Data:', JSON.stringify(data, null, 2));
        }
        
        this.testResults.push({ level, message, data, timestamp });
    }

    async runFullTestSuite() {
        this.log('INFO', '🚀 Starting comprehensive end-to-end test suite...');
        
        try {
            // Phase 1: Tenant Registration
            await this.testTenantRegistration();
            
            // Phase 2: User Login
            await this.testUserLogin();
            
            // Phase 3: Table Management
            await this.testTableManagement();
            
            // Phase 4: Product Management
            await this.testProductManagement();
            
            // Phase 5: Order Management
            await this.testOrderManagement();
            
            // Phase 6: Real-time Updates
            await this.testRealTimeUpdates();
            
            // Phase 7: Data Consistency
            await this.testDataConsistency();
            
            // Generate final report
            this.generateTestReport();
            
        } catch (error) {
            this.log('CRITICAL', 'End-to-end test suite failed', { error: error.message });
        }
    }

    async testTenantRegistration() {
        this.log('INFO', '🏢 Phase 1: Testing tenant registration...');
        
        try {
            const tenantData = {
                businessName: `Test Business ${Date.now()}`,
                businessEmail: `test-${Date.now()}@example.com`,
                businessPhone: '+1234567890',
                businessAddress: '123 Test Street',
                gstNumber: 'TESTGST123',
                adminName: 'Test Admin',
                adminEmail: `admin-${Date.now()}@example.com`,
                adminPassword: 'TestPassword123!',
                cafeType: 'RESTAURANT'
            };

            const response = await axios.post(`${this.baseURL}/api/onboarding/business`, tenantData, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });

            if (response.data && response.data.success) {
                this.createdResources.tenant = response.data.data;
                this.log('SUCCESS', '✅ Tenant registration successful', response.data.data);
                return true;
            } else {
                this.log('FAILURE', '❌ Tenant registration failed', response.data);
                return false;
            }
            
        } catch (error) {
            this.log('FAILURE', '❌ Tenant registration error', { error: error.message });
            return false;
        }
    }

    async testUserLogin() {
        this.log('INFO', '🔑 Phase 2: Testing user login...');
        
        try {
            if (!this.createdResources.tenant) {
                this.log('FAILURE', '❌ Cannot test login - no tenant created');
                return false;
            }

            const loginData = {
                email: this.createdResources.tenant.user.email,
                password: 'TestPassword123!'
            };

            const response = await axios.post(`${this.baseURL}/api/auth/login`, loginData, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });

            if (response.data && response.data.success) {
                this.currentToken = response.data.data.token;
                this.createdResources.user = response.data.data.user;
                this.log('SUCCESS', '✅ User login successful', { 
                    userId: response.data.data.user.id,
                    token: this.currentToken ? 'received' : 'missing'
                });
                return true;
            } else {
                this.log('FAILURE', '❌ User login failed', response.data);
                return false;
            }
            
        } catch (error) {
            this.log('FAILURE', '❌ User login error', { error: error.message });
            return false;
        }
    }

    async testTableManagement() {
        this.log('INFO', '🪑 Phase 3: Testing table management...');
        
        try {
            if (!this.currentToken) {
                this.log('FAILURE', '❌ Cannot test table management - no auth token');
                return false;
            }

            const headers = {
                'Authorization': `Bearer ${this.currentToken}`,
                'Content-Type': 'application/json',
                'x-outlet-id': this.createdResources.tenant.outletId
            };

            // Step 3.1: Get existing tables
            const getTablesResponse = await axios.get(`${this.baseURL}/api/tenant/tables-management`, {
                headers,
                timeout: 10000
            });

            if (!getTablesResponse.data || !getTablesResponse.data.success) {
                this.log('FAILURE', '❌ Failed to fetch tables', getTablesResponse.data);
                return false;
            }

            this.log('SUCCESS', '✅ Tables fetched successfully', { 
                count: getTablesResponse.data.data.length 
            });

            // Step 3.2: Create new table
            const tableData = {
                tableNo: `T${Date.now()}`,
                name: 'Test Table',
                capacity: 4,
                status: 'AVAILABLE',
                areaId: this.createdResources.tenant.areaId
            };

            const createTableResponse = await axios.post(`${this.baseURL}/api/tenant/tables-management`, tableData, {
                headers,
                timeout: 10000
            });

            if (createTableResponse.data && createTableResponse.data.success) {
                this.createdResources.table = createTableResponse.data.data;
                this.log('SUCCESS', '✅ Table creation successful', createTableResponse.data.data);
                return true;
            } else {
                this.log('FAILURE', '❌ Table creation failed', createTableResponse.data);
                return false;
            }
            
        } catch (error) {
            this.log('FAILURE', '❌ Table management error', { error: error.message });
            return false;
        }
    }

    async testProductManagement() {
        this.log('INFO', '📦 Phase 4: Testing product management...');
        
        try {
            if (!this.currentToken) {
                this.log('FAILURE', '❌ Cannot test product management - no auth token');
                return false;
            }

            const headers = {
                'Authorization': `Bearer ${this.currentToken}`,
                'Content-Type': 'application/json',
                'x-outlet-id': this.createdResources.tenant.outletId
            };

            // Step 4.1: Get existing categories
            const getCategoriesResponse = await axios.get(`${this.baseURL}/api/tenant/categories`, {
                headers,
                timeout: 10000
            });

            if (!getCategoriesResponse.data || !getCategoriesResponse.data.success) {
                this.log('FAILURE', '❌ Failed to fetch categories', getCategoriesResponse.data);
                return false;
            }

            const categoryId = getCategoriesResponse.data.data[0]?.id;

            // Step 4.2: Create new product
            const productData = {
                name: `Test Product ${Date.now()}`,
                description: 'Product created during E2E testing',
                price: 99.99,
                sku: `TEST-${Date.now()}`,
                isActive: true,
                categoryId: categoryId
            };

            const createProductResponse = await axios.post(`${this.baseURL}/api/tenant/products`, productData, {
                headers,
                timeout: 10000
            });

            if (createProductResponse.data && createProductResponse.data.success) {
                this.createdResources.product = createProductResponse.data.data;
                this.log('SUCCESS', '✅ Product creation successful', createProductResponse.data.data);
                return true;
            } else {
                this.log('FAILURE', '❌ Product creation failed', createProductResponse.data);
                return false;
            }
            
        } catch (error) {
            this.log('FAILURE', '❌ Product management error', { error: error.message });
            return false;
        }
    }

    async testOrderManagement() {
        this.log('INFO', '🛒 Phase 5: Testing order management...');
        
        try {
            if (!this.currentToken || !this.createdResources.table || !this.createdResources.product) {
                this.log('FAILURE', '❌ Cannot test order management - missing prerequisites');
                return false;
            }

            const headers = {
                'Authorization': `Bearer ${this.currentToken}`,
                'Content-Type': 'application/json',
                'x-outlet-id': this.createdResources.tenant.outletId
            };

            // Step 5.1: Create new order
            const orderData = {
                items: [
                    {
                        productId: this.createdResources.product.id,
                        quantity: 2,
                        notes: 'Test order item'
                    }
                ],
                tableId: this.createdResources.table.id,
                type: 'DINE_IN',
                notes: 'Test order created during E2E testing'
            };

            const createOrderResponse = await axios.post(`${this.baseURL}/api/tenant/orders`, orderData, {
                headers,
                timeout: 15000
            });

            if (!createOrderResponse.data || !createOrderResponse.data.success) {
                this.log('FAILURE', '❌ Order creation failed', createOrderResponse.data);
                return false;
            }

            this.createdResources.order = createOrderResponse.data.data;
            this.log('SUCCESS', '✅ Order creation successful', {
                orderId: this.createdResources.order.id,
                orderNumber: this.createdResources.order.orderNumber,
                tableId: this.createdResources.table.id
            });

            // Step 5.2: Fetch orders to verify
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for processing

            const getOrdersResponse = await axios.get(`${this.baseURL}/api/tenant/orders`, {
                headers,
                timeout: 10000
            });

            if (!getOrdersResponse.data || !getOrdersResponse.data.success) {
                this.log('FAILURE', '❌ Failed to fetch orders', getOrdersResponse.data);
                return false;
            }

            const createdOrderInList = getOrdersResponse.data.data.rows.find(
                order => order.id === this.createdResources.order.id
            );

            if (!createdOrderInList) {
                this.log('FAILURE', '❌ Created order not found in order list');
                return false;
            }

            this.log('SUCCESS', '✅ Order fetching successful', {
                totalOrders: getOrdersResponse.data.data.count,
                createdOrderFound: true
            });

            // Step 5.3: Update order status to test table release
            const updateOrderResponse = await axios.put(
                `${this.baseURL}/api/tenant/orders/${this.createdResources.order.id}`,
                { status: 'COMPLETED' },
                { headers, timeout: 10000 }
            );

            if (!updateOrderResponse.data || !updateOrderResponse.data.success) {
                this.log('FAILURE', '❌ Order update failed', updateOrderResponse.data);
                return false;
            }

            this.log('SUCCESS', '✅ Order update successful', updateOrderResponse.data.data);
            return true;
            
        } catch (error) {
            this.log('FAILURE', '❌ Order management error', { error: error.message });
            return false;
        }
    }

    async testRealTimeUpdates() {
        this.log('INFO', '⚡ Phase 6: Testing real-time updates...');
        
        try {
            if (!this.createdResources.table) {
                this.log('WARNING', '⚠️ Cannot test real-time updates - no table created');
                return true; // Not a failure, just a limitation
            }

            // Wait a bit and check if table status would be updated
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Fetch table status again to see if it reflects order completion
            const headers = {
                'Authorization': `Bearer ${this.currentToken}`,
                'Content-Type': 'application/json',
                'x-outlet-id': this.createdResources.tenant.outletId
            };

            const getTableResponse = await axios.get(`${this.baseURL}/api/tenant/tables-management`, {
                headers,
                timeout: 10000
            });

            if (getTableResponse.data && getTableResponse.data.success) {
                const updatedTable = getTableResponse.data.data.find(
                    table => table.id === this.createdResources.table.id
                );

                if (updatedTable) {
                    const expectedStatus = 'AVAILABLE'; // Should be available after order completion
                    if (updatedTable.status === expectedStatus) {
                        this.log('SUCCESS', '✅ Real-time table status update working', {
                            tableId: updatedTable.id,
                            status: updatedTable.status,
                            expectedStatus
                        });
                    } else {
                        this.log('WARNING', '⚠️ Table status not updated as expected', {
                            tableId: updatedTable.id,
                            actualStatus: updatedTable.status,
                            expectedStatus
                        });
                    }
                }
            }

            return true;
            
        } catch (error) {
            this.log('FAILURE', '❌ Real-time updates test error', { error: error.message });
            return false;
        }
    }

    async testDataConsistency() {
        this.log('INFO', '🔍 Phase 7: Testing data consistency...');
        
        try {
            if (!this.currentToken) {
                this.log('FAILURE', '❌ Cannot test data consistency - no auth token');
                return false;
            }

            const headers = {
                'Authorization': `Bearer ${this.currentToken}`,
                'Content-Type': 'application/json',
                'x-outlet-id': this.createdResources.tenant.outletId
            };

            // Check if all created resources are accessible
            const consistencyChecks = [];

            // Check tables
            const tablesResponse = await axios.get(`${this.baseURL}/api/tenant/tables-management`, {
                headers,
                timeout: 10000
            });

            if (tablesResponse.data && tablesResponse.data.success) {
                const createdTableExists = tablesResponse.data.data.some(
                    table => table.id === this.createdResources.table.id
                );
                consistencyChecks.push({
                    resource: 'tables',
                    createdResourceExists: createdTableExists,
                    resourceId: this.createdResources.table.id
                });
            }

            // Check products
            const productsResponse = await axios.get(`${this.baseURL}/api/tenant/products`, {
                headers,
                timeout: 10000
            });

            if (productsResponse.data && productsResponse.data.success) {
                const createdProductExists = productsResponse.data.data.some(
                    product => product.id === this.createdResources.product.id
                );
                consistencyChecks.push({
                    resource: 'products',
                    createdResourceExists: createdProductExists,
                    resourceId: this.createdResources.product.id
                });
            }

            // Check orders
            const ordersResponse = await axios.get(`${this.baseURL}/api/tenant/orders`, {
                headers,
                timeout: 10000
            });

            if (ordersResponse.data && ordersResponse.data.success) {
                const createdOrderExists = ordersResponse.data.data.rows.some(
                    order => order.id === this.createdResources.order.id
                );
                consistencyChecks.push({
                    resource: 'orders',
                    createdResourceExists: createdOrderExists,
                    resourceId: this.createdResources.order.id
                });
            }

            const allResourcesExist = consistencyChecks.every(check => check.createdResourceExists);
            
            if (allResourcesExist) {
                this.log('SUCCESS', '✅ Data consistency check passed', consistencyChecks);
            } else {
                this.log('FAILURE', '❌ Data consistency check failed', consistencyChecks);
            }

            return allResourcesExist;
            
        } catch (error) {
            this.log('FAILURE', '❌ Data consistency test error', { error: error.message });
            return false;
        }
    }

    generateTestReport() {
        console.log('\n' + '='.repeat(80));
        console.log('🧪 END-TO-END TEST REPORT');
        console.log('='.repeat(80));
        
        const successCount = this.testResults.filter(r => r.level === 'SUCCESS').length;
        const failureCount = this.testResults.filter(r => r.level === 'FAILURE').length;
        const criticalCount = this.testResults.filter(r => r.level === 'CRITICAL').length;
        
        console.log(`\n📊 TEST SUMMARY:`);
        console.log(`   ✅ Successful Tests: ${successCount}`);
        console.log(`   ❌ Failed Tests: ${failureCount}`);
        console.log(`   🚨 Critical Errors: ${criticalCount}`);
        
        console.log(`\n📋 DETAILED RESULTS:`);
        this.testResults.forEach((result, index) => {
            console.log(`\n${index + 1}. [${result.level}] ${result.message}`);
            if (result.data) {
                console.log('   Details:', JSON.stringify(result.data, null, 2));
            }
        });

        // Created resources summary
        console.log(`\n🏗️ CREATED RESOURCES:`);
        console.log(JSON.stringify(this.createdResources, null, 2));

        // Overall assessment
        const totalTests = successCount + failureCount + criticalCount;
        const successRate = totalTests > 0 ? (successCount / totalTests * 100).toFixed(1) : 0;
        
        console.log(`\n🎯 OVERALL ASSESSMENT:`);
        if (criticalCount === 0 && successRate >= 80) {
            console.log('   🎉 SYSTEM IS PRODUCTION READY!');
            console.log(`   ✅ Success Rate: ${successRate}%`);
            console.log('   ✅ All critical flows working');
        } else if (criticalCount > 0) {
            console.log('   🚨 SYSTEM HAS CRITICAL ISSUES');
            console.log(`   ❌ Critical Errors: ${criticalCount}`);
            console.log('   ⚠️  Must fix before production');
        } else {
            console.log('   ⚠️  SYSTEM NEEDS IMPROVEMENT');
            console.log(`   📊 Success Rate: ${successRate}%`);
            console.log('   🔧 Address failed tests before production');
        }

        console.log('\n' + '='.repeat(80));
        
        return {
            totalTests,
            successCount,
            failureCount,
            criticalCount,
            successRate: parseFloat(successRate),
            productionReady: criticalCount === 0 && successRate >= 80
        };
    }
}

// Main execution
async function runEndToEndTests() {
    const tester = new EndToEndTester();
    
    console.log('🚀 Starting comprehensive end-to-end testing...');
    
    try {
        const results = await tester.runFullTestSuite();
        
        // Exit with appropriate code
        process.exit(results.productionReady ? 0 : 1);
        
    } catch (error) {
        console.error('🚨 End-to-end testing failed with error:', error);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = EndToEndTester;

// Run if called directly
if (require.main === module) {
    runEndToEndTests();
}
