#!/usr/bin/env node
/**
 * 🔐 AUTH API TEST & FIX SCRIPT
 * Tests auth endpoints and verifies multi-tenant data integrity
 */

const { sequelize } = require('../config/unified_database');
const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

class AuthAPITester {
    constructor() {
        this.baseURL = process.env.API_BASE_URL || 'http://localhost:3000';
        this.testUser = null;
        this.token = null;
        this.results = [];
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
        console.log(`${colors.bright}${colors.magenta}                 AUTH API TEST & FIX SERVICE${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

        try {
            await sequelize.authenticate();
            this.log('success', 'Database connected');

            // Step 1: Check control plane tables
            await this.verifyControlPlaneTables();

            // Step 2: Check existing users
            await this.checkExistingUsers();

            // Step 3: Create test user if needed
            await this.ensureTestUser();

            // Step 4: Test auth service directly
            await this.testAuthService();

            // Step 5: Verify API endpoints (if server running)
            await this.testAPIEndpoints();

            // Step 6: Verify multi-tenant data integrity
            await this.verifyMultiTenantIntegrity();

            this.generateReport();

        } catch (error) {
            this.log('error', 'Test service failed', error.message);
            console.error(error.stack);
        } finally {
            await sequelize.close();
        }
    }

    async verifyControlPlaneTables() {
        this.log('section', 'Verifying Control Plane Tables');

        const requiredTables = ['businesses', 'users', 'tenant_registry'];
        
        for (const table of requiredTables) {
            const exists = await sequelize.query(
                `SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = :table
                )`,
                { replacements: { table }, type: Sequelize.QueryTypes.SELECT }
            );

            if (exists[0].exists) {
                this.log('success', `✓ ${table} exists`);
            } else {
                this.log('error', `✗ ${table} MISSING`);
            }
        }
    }

    async checkExistingUsers() {
        this.log('section', 'Checking Existing Users');

        const users = await sequelize.query(
            'SELECT id, name, email, role, business_id, is_active FROM public.users LIMIT 5',
            { type: Sequelize.QueryTypes.SELECT }
        );

        this.log('info', `Found ${users.length} users in control plane`);
        
        for (const user of users) {
            console.log(`  - ${user.email} (${user.role}) - Business: ${user.business_id?.slice(0, 8)}...`);
        }

        return users;
    }

    async ensureTestUser() {
        this.log('section', 'Ensuring Test User Exists');

        // Check if test user exists
        const existingUser = await sequelize.query(
            'SELECT id FROM public.users WHERE email = :email',
            { replacements: { email: 'test@brewwlabs.com' }, type: Sequelize.QueryTypes.SELECT }
        );

        if (existingUser.length > 0) {
            this.log('success', 'Test user already exists');
            this.testUser = existingUser[0];
            return;
        }

        // Need to find a business first
        const business = await sequelize.query(
            'SELECT id FROM public.businesses LIMIT 1',
            { type: Sequelize.QueryTypes.SELECT }
        );

        if (business.length === 0) {
            this.log('error', 'No businesses found - cannot create test user');
            return;
        }

        const businessId = business[0].id;
        const hashedPassword = await bcrypt.hash('testpassword123', 10);

        try {
            const result = await sequelize.query(
                `INSERT INTO public.users (id, name, email, password, role, business_id, is_active, created_at, updated_at)
                 VALUES (:id, :name, :email, :password, :role, :businessId, true, NOW(), NOW())
                 RETURNING id`,
                {
                    replacements: {
                        id: uuidv4(),
                        name: 'Test User',
                        email: 'test@brewwlabs.com',
                        password: hashedPassword,
                        role: 'ADMIN',
                        businessId
                    },
                    type: Sequelize.QueryTypes.INSERT
                }
            );

            this.log('success', 'Test user created successfully');
            this.testUser = { id: result[0][0].id };
        } catch (error) {
            this.log('error', 'Failed to create test user', error.message);
        }
    }

    async testAuthService() {
        this.log('section', 'Testing Auth Service Directly');

        try {
            const authService = require('../services/authService');
            
            // Test login
            this.log('info', 'Testing login...');
            const user = await authService.login('test@brewwlabs.com', 'testpassword123');
            
            if (user) {
                this.log('success', '✓ Login successful', `User: ${user.name}, Role: ${user.role}`);
                
                // Test token generation
                this.log('info', 'Testing token generation...');
                const accessToken = await authService.generateAccessToken(user);
                const refreshToken = authService.generateRefreshToken(user);
                
                if (accessToken && refreshToken) {
                    this.log('success', '✓ Tokens generated successfully');
                    this.token = accessToken;
                } else {
                    this.log('error', '✗ Token generation failed');
                }
            } else {
                this.log('error', '✗ Login failed - no user returned');
            }
        } catch (error) {
            this.log('error', 'Auth service test failed', error.message);
            console.error('Full error:', error);
        }
    }

    async testAPIEndpoints() {
        this.log('section', 'Testing API Endpoints');

        const endpoints = [
            { method: 'POST', url: '/api/auth/login', data: { email: 'test@brewwlabs.com', password: 'testpassword123' }, name: 'Login' },
            { method: 'POST', url: '/api/auth/logout', data: {}, name: 'Logout' },
            { method: 'POST', url: '/api/auth/refresh', data: {}, name: 'Refresh Token' }
        ];

        for (const endpoint of endpoints) {
            try {
                this.log('info', `Testing ${endpoint.name}...`);
                
                const config = {
                    method: endpoint.method,
                    url: `${this.baseURL}${endpoint.url}`,
                    data: endpoint.data,
                    timeout: 5000,
                    validateStatus: () => true // Don't throw on error status
                };

                const response = await axios(config);
                
                if (response.status >= 200 && response.status < 300) {
                    this.log('success', `✓ ${endpoint.name}: ${response.status}`, response.data?.message || 'OK');
                } else if (response.status === 404) {
                    this.log('warning', `⚠ ${endpoint.name}: Endpoint not found (404)`);
                } else if (response.status === 501) {
                    this.log('warning', `⚠ ${endpoint.name}: Not implemented (501)`);
                } else {
                    this.log('error', `✗ ${endpoint.name}: ${response.status}`, response.data?.message || 'Error');
                }
            } catch (error) {
                if (error.code === 'ECONNREFUSED') {
                    this.log('warning', `⚠ ${endpoint.name}: Server not running`);
                } else {
                    this.log('error', `✗ ${endpoint.name}: ${error.message}`);
                }
            }
        }
    }

    async verifyMultiTenantIntegrity() {
        this.log('section', 'Verifying Multi-Tenant Data Integrity');

        // Check all users have valid business associations
        const orphanedUsers = await sequelize.query(
            `SELECT u.id, u.email, u.business_id 
             FROM public.users u
             LEFT JOIN public.businesses b ON u.business_id = b.id
             WHERE b.id IS NULL`,
            { type: Sequelize.QueryTypes.SELECT }
        );

        if (orphanedUsers.length > 0) {
            this.log('error', `Found ${orphanedUsers.length} orphaned users`, orphanedUsers.map(u => u.email).join(', '));
        } else {
            this.log('success', '✓ All users linked to valid businesses');
        }

        // Check tenant registry consistency
        const registryEntries = await sequelize.query(
            'SELECT business_id, schema_name, status FROM public.tenant_registry',
            { type: Sequelize.QueryTypes.SELECT }
        );

        for (const entry of registryEntries) {
            // Verify schema exists
            const schemaExists = await sequelize.query(
                'SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema',
                { replacements: { schema: entry.schema_name }, type: Sequelize.QueryTypes.SELECT }
            );

            if (schemaExists.length === 0) {
                this.log('error', `✗ Schema missing for ${entry.schema_name}`, `Status: ${entry.status}`);
            } else {
                this.log('success', `✓ ${entry.schema_name} exists (${entry.status})`);
            }
        }
    }

    generateReport() {
        console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}                    AUTH API TEST REPORT${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

        console.log(`${colors.green}✅ Tests Completed${colors.reset}`);
        console.log(`\n${colors.cyan}To run the API tests with a running server:${colors.reset}`);
        console.log(`  1. Start the server: node server.js`);
        console.log(`  2. Re-run this test: node scripts/testAuthAPI.js`);
        console.log(`\n${colors.cyan}Test credentials:${colors.reset}`);
        console.log(`  Email: test@brewwlabs.com`);
        console.log(`  Password: testpassword123`);

        console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);
    }
}

// Run if called directly
if (require.main === module) {
    const tester = new AuthAPITester();
    tester.run();
}

module.exports = AuthAPITester;
