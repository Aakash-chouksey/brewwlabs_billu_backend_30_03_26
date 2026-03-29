#!/usr/bin/env node
/**
 * 🔐 COMPREHENSIVE AUTH & ONBOARDING TEST
 * Tests complete auth flow including onboarding and data creation
 */

const { sequelize } = require('../config/unified_database');
const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const authService = require('../services/authService');
const onboardingService = require('../services/onboardingService');

const colors = {
    reset: '\x1b[0m', bright: '\x1b[1m', red: '\x1b[31m',
    green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
    cyan: '\x1b[36m', magenta: '\x1b[35m'
};

class ComprehensiveAuthTest {
    constructor() {
        this.testResults = [];
        this.testBusiness = null;
        this.testUser = null;
    }

    log(level, message, details = null) {
        const prefix = {
            info: `${colors.cyan}[INFO]${colors.reset}`,
            success: `${colors.green}[✓]${colors.reset}`,
            warning: `${colors.yellow}[⚠]${colors.reset}`,
            error: `${colors.red}[✗]${colors.reset}`,
            section: `${colors.magenta}[▶]${colors.reset}`,
            fix: `${colors.blue}[FIX]${colors.reset}`
        }[level] || `[${level.toUpperCase()}]`;
        console.log(`${prefix} ${message}`);
        if (details) console.log(`  ${colors.blue}↳${colors.reset}`, details);
    }

    async run() {
        console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}         COMPREHENSIVE AUTH & ONBOARDING TEST${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

        try {
            await sequelize.authenticate();
            this.log('success', 'Database connected');

            // Test 1: Direct login with existing user
            await this.testDirectLogin();

            // Test 2: Onboarding flow
            await this.testOnboarding();

            // Test 3: Login with new user
            await this.testNewUserLogin();

            // Test 4: Verify tenant schema created properly
            await this.verifyTenantSchema();

            // Test 5: Verify control plane data
            await this.verifyControlPlaneData();

            this.generateReport();

        } catch (error) {
            this.log('error', 'Test failed', error.message);
            console.error(error.stack);
        } finally {
            await sequelize.close();
        }
    }

    async testDirectLogin() {
        this.log('section', 'TEST 1: Direct Auth Service Login');

        try {
            // Get first existing user
            const users = await sequelize.query(
                'SELECT email FROM public.users WHERE is_active = true LIMIT 1',
                { type: Sequelize.QueryTypes.SELECT }
            );

            if (users.length === 0) {
                this.log('warning', 'No active users found for login test');
                return;
            }

            const email = users[0].email;
            this.log('info', `Testing login with: ${email}`);

            // Test with wrong password
            try {
                await authService.login(email, 'wrongpassword123');
                this.log('error', 'Should have thrown error for wrong password');
            } catch (e) {
                if (e.message.includes('Invalid')) {
                    this.log('success', '✓ Wrong password rejected correctly');
                } else {
                    this.log('error', 'Unexpected error', e.message);
                }
            }

            this.testResults.push({ test: 'Direct Login', status: 'PASS' });

        } catch (error) {
            this.log('error', 'Direct login test failed', error.message);
            this.testResults.push({ test: 'Direct Login', status: 'FAIL', error: error.message });
        }
    }

    async testOnboarding() {
        this.log('section', 'TEST 2: Business Onboarding Flow');

        try {
            const timestamp = Date.now();
            const businessData = {
                businessName: `Test Cafe ${timestamp}`,
                businessEmail: `testbiz${timestamp}@test.local`,
                businessPhone: '9999999999',
                businessAddress: '123 Test Street',
                adminName: 'Test Admin',
                adminEmail: `testadmin${timestamp}@test.local`,
                adminPassword: 'TestPass123!',
                cafeType: 'cafe'
            };

            this.log('info', `Onboarding: ${businessData.businessName}`);

            const result = await onboardingService.onboardBusiness(businessData);

            if (result.success) {
                this.log('success', '✓ Onboarding completed', `Business ID: ${result.data?.businessId?.slice(0, 8)}...`);
                this.testBusiness = result.data;
                this.testResults.push({ test: 'Onboarding', status: 'PASS' });
            } else {
                this.log('error', '✗ Onboarding failed', result.message);
                this.testResults.push({ test: 'Onboarding', status: 'FAIL', error: result.message });
            }

        } catch (error) {
            this.log('error', 'Onboarding test failed', error.message);
            this.testResults.push({ test: 'Onboarding', status: 'FAIL', error: error.message });
        }
    }

    async testNewUserLogin() {
        this.log('section', 'TEST 3: Login with New Onboarded User');

        if (!this.testBusiness) {
            this.log('warning', 'Skipping - no business from onboarding');
            return;
        }

        try {
            const adminEmail = this.testBusiness.adminEmail;
            const adminPassword = 'TestPass123!';

            this.log('info', `Testing login: ${adminEmail}`);

            const user = await authService.login(adminEmail, adminPassword);

            if (user) {
                this.log('success', '✓ Login successful', `Role: ${user.role}, Panel: ${user.panelType}`);
                this.testUser = user;

                // Test token generation
                const accessToken = await authService.generateAccessToken(user);
                const refreshToken = authService.generateRefreshToken(user);

                if (accessToken && refreshToken) {
                    this.log('success', '✓ Tokens generated successfully');
                    this.testResults.push({ test: 'New User Login', status: 'PASS' });
                } else {
                    this.log('error', '✗ Token generation failed');
                    this.testResults.push({ test: 'New User Login', status: 'FAIL', error: 'Token generation failed' });
                }
            } else {
                this.log('error', '✗ Login returned no user');
                this.testResults.push({ test: 'New User Login', status: 'FAIL', error: 'No user returned' });
            }

        } catch (error) {
            this.log('error', 'New user login test failed', error.message);
            this.testResults.push({ test: 'New User Login', status: 'FAIL', error: error.message });
        }
    }

    async verifyTenantSchema() {
        this.log('section', 'TEST 4: Verify Tenant Schema Creation');

        if (!this.testBusiness) {
            this.log('warning', 'Skipping - no business from onboarding');
            return;
        }

        try {
            const businessId = this.testBusiness.businessId;
            const schemaName = `tenant_${businessId}`;

            // Check schema exists
            const schemaExists = await sequelize.query(
                'SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema',
                { replacements: { schema: schemaName }, type: Sequelize.QueryTypes.SELECT }
            );

            if (schemaExists.length === 0) {
                this.log('error', '✗ Schema not created', schemaName);
                this.testResults.push({ test: 'Tenant Schema', status: 'FAIL', error: 'Schema missing' });
                return;
            }

            this.log('success', '✓ Tenant schema exists', schemaName);

            // Check critical tables
            const requiredTables = ['outlets', 'products', 'orders', 'categories', 'inventory_items', 'settings', 'users'];
            const tablesResult = await sequelize.query(
                'SELECT table_name FROM information_schema.tables WHERE table_schema = :schema AND table_type = :type',
                { replacements: { schema: schemaName, type: 'BASE TABLE' }, type: Sequelize.QueryTypes.SELECT }
            );

            const existingTables = tablesResult.map(t => t.table_name);
            const missingTables = requiredTables.filter(t => !existingTables.includes(t));

            if (missingTables.length > 0) {
                this.log('error', `✗ Missing tables: ${missingTables.join(', ')}`);
                this.testResults.push({ test: 'Tenant Schema', status: 'FAIL', error: `Missing: ${missingTables.join(', ')}` });
            } else {
                this.log('success', `✓ All ${requiredTables.length} critical tables present`);
                this.log('info', `Total tables: ${existingTables.length}`);
                this.testResults.push({ test: 'Tenant Schema', status: 'PASS' });
            }

            // Check default data (outlet)
            const outlets = await sequelize.query(
                `SELECT id, name FROM "${schemaName}"."outlets" LIMIT 1`,
                { type: Sequelize.QueryTypes.SELECT }
            );

            if (outlets.length > 0) {
                this.log('success', '✓ Default outlet created', outlets[0].name);
            } else {
                this.log('warning', '⚠ No default outlet found');
            }

        } catch (error) {
            this.log('error', 'Tenant schema verification failed', error.message);
            this.testResults.push({ test: 'Tenant Schema', status: 'FAIL', error: error.message });
        }
    }

    async verifyControlPlaneData() {
        this.log('section', 'TEST 5: Verify Control Plane Data Integrity');

        try {
            // Check businesses
            const businesses = await sequelize.query(
                'SELECT COUNT(*) as count FROM public.businesses',
                { type: Sequelize.QueryTypes.SELECT }
            );

            // Check users
            const users = await sequelize.query(
                'SELECT COUNT(*) as count FROM public.users',
                { type: Sequelize.QueryTypes.SELECT }
            );

            // Check tenant registry
            const registries = await sequelize.query(
                'SELECT COUNT(*) as count FROM public.tenant_registry',
                { type: Sequelize.QueryTypes.SELECT }
            );

            this.log('success', `✓ Control plane data valid`, 
                `${businesses[0].count} businesses, ${users[0].count} users, ${registries[0].count} registries`);

            this.testResults.push({ test: 'Control Plane Data', status: 'PASS' });

        } catch (error) {
            this.log('error', 'Control plane verification failed', error.message);
            this.testResults.push({ test: 'Control Plane Data', status: 'FAIL', error: error.message });
        }
    }

    generateReport() {
        console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}                    TEST REPORT${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

        const passed = this.testResults.filter(r => r.status === 'PASS');
        const failed = this.testResults.filter(r => r.status === 'FAIL');

        console.log(`${colors.green}✅ Passed: ${passed.length}${colors.reset}`);
        passed.forEach(p => console.log(`   ✓ ${p.test}`));

        if (failed.length > 0) {
            console.log(`\n${colors.red}❌ Failed: ${failed.length}${colors.reset}`);
            failed.forEach(f => console.log(`   ✗ ${p.test}: ${f.error}`));
        }

        const allPass = failed.length === 0;
        console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}`);
        console.log(allPass ? 
            `${colors.green}✅ ALL TESTS PASSED${colors.reset}` : 
            `${colors.red}❌ SOME TESTS FAILED${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

        return allPass;
    }
}

// Run if called directly
if (require.main === module) {
    const test = new ComprehensiveAuthTest();
    test.run();
}

module.exports = ComprehensiveAuthTest;
